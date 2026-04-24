'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addDays,
  addMonths,
  endOfMonth,
  isSameDay,
  max,
  min,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import type { DateRange } from 'react-day-picker'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn, formatDate } from '@/lib/utils'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import type { ProgramaCalibacionConInstrumento, ProgramaComplianceGaps } from '@/types/ema'
import ProgramaListView from './ProgramaListView'
import ProgramaWeekView from './ProgramaWeekView'
import {
  DAY_NAMES,
  MONTH_NAMES,
  daysUntil,
  eventPillClass,
  groupProgramaByDay,
  localDateKey,
  programaDateKey,
} from './programaHelpers'

const WEEK_STARTS_ON = 0 as const

type ViewMode = 'week' | 'month' | 'day' | 'list'

function defaultRange(): DateRange {
  const today = new Date()
  return { from: subDays(today, 7), to: addDays(today, 120) }
}

function rangeToIsoStrings(dr: DateRange | undefined): { desde: string; hasta: string } | null {
  if (!dr?.from || !dr?.to) return null
  const desde = formatDate(dr.from, 'yyyy-MM-dd')
  const hasta = formatDate(dr.to, 'yyyy-MM-dd')
  return { desde, hasta }
}

/** Widen the filter range so week/month/day views always request programa rows for the grid, not only the list range. */
function mergeVisibleCalendarIntoRange(
  base: DateRange | undefined,
  viewMode: ViewMode,
  currentMonth: Date,
  weekStart: Date,
  selectedDate: Date | undefined,
): { desde: string; hasta: string } | null {
  const r = rangeToIsoStrings(base)
  if (!r || !base?.from || !base?.to) return r
  let from = base.from
  let to = base.to
  if (viewMode === 'month') {
    const ms = startOfMonth(currentMonth)
    const me = endOfMonth(currentMonth)
    from = min([from, ms])
    to = max([to, me])
  } else if (viewMode === 'week') {
    const ws = weekStart
    const we = addDays(weekStart, 6)
    from = min([from, ws])
    to = max([to, we])
  } else if (viewMode === 'day') {
    const d = selectedDate ?? new Date()
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    from = min([from, dayStart])
    to = max([to, dayStart])
  }
  return { desde: formatDate(from, 'yyyy-MM-dd'), hasta: formatDate(to, 'yyyy-MM-dd') }
}

export default function ProgramaHubClient() {
  const router = useRouter()
  const { currentPlant, availablePlants } = usePlantContext()
  const initialDateRange = useMemo(() => defaultRange(), [])

  const [entries, setEntries] = useState<ProgramaCalibacionConInstrumento[]>([])
  const [gaps, setGaps] = useState<ProgramaComplianceGaps | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date())
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }),
  )
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())

  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: initialDateRange.from ? new Date(initialDateRange.from) : undefined,
    to: initialDateRange.to ? new Date(initialDateRange.to) : undefined,
  }))
  const [filterPlant, setFilterPlant] = useState(currentPlant?.id ?? 'all')
  const [filterEstado, setFilterEstado] = useState('pendiente')
  const [filterTipo, setFilterTipo] = useState('all')

  const fetchPrograma = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterPlant !== 'all') params.set('plant_id', filterPlant)
      if (filterEstado !== 'all') params.set('estado', filterEstado)
      if (filterTipo !== 'all') params.set('tipo_evento', filterTipo)
      const r = mergeVisibleCalendarIntoRange(dateRange, viewMode, currentMonth, weekStart, selectedDate)
      if (r) {
        params.set('fecha_desde', r.desde)
        params.set('fecha_hasta', r.hasta)
      }
      params.set('include_gaps', '1')
      const res = await fetch(`/api/ema/programa?${params}`)
      if (!res.ok) throw new Error('Error cargando programa')
      const json = await res.json()
      const d = json.data
      if (Array.isArray(d)) {
        setEntries(d)
        setGaps(null)
      } else {
        setEntries(d?.entries ?? [])
        setGaps(d?.gaps ?? null)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [filterPlant, filterEstado, filterTipo, dateRange, viewMode, currentMonth, weekStart, selectedDate])

  useEffect(() => {
    void fetchPrograma()
  }, [fetchPrograma])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchPrograma()
    } finally {
      setRefreshing(false)
    }
  }, [fetchPrograma])

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const inst = e.instrumento
      const cod = (inst?.codigo ?? '').toLowerCase()
      const nom = (inst?.nombre ?? '').toLowerCase()
      return cod.includes(q) || nom.includes(q)
    })
  }, [entries, searchQuery])

  const eventsByDate = useMemo(() => groupProgramaByDay(filteredEntries), [filteredEntries])

  const muestrasForSelectedDay = useMemo(() => {
    if (!selectedDate) return []
    const k = localDateKey(selectedDate)
    return filteredEntries.filter((e) => programaDateKey(e.fecha_programada) === k)
  }, [filteredEntries, selectedDate])

  const onSelectDate = useCallback((d: Date | undefined) => {
    setSelectedDate(d)
    if (d) {
      setWeekStart(startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }))
      setCurrentMonth(d)
    }
  }, [])

  const dateRangeLabel = (() => {
    if (!dateRange?.from) return 'Rango de fechas'
    if (dateRange.from && dateRange.to) {
      return `${formatDate(dateRange.from, 'dd/MM/yy')} – ${formatDate(dateRange.to, 'dd/MM/yy')}`
    }
    return `Desde ${formatDate(dateRange.from, 'dd/MM/yy')}`
  })()

  const rangeDirty = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !initialDateRange.from || !initialDateRange.to) return false
    const a = formatDate(dateRange.from, 'yyyy-MM-dd')
    const b = formatDate(dateRange.to, 'yyyy-MM-dd')
    const ia = formatDate(initialDateRange.from, 'yyyy-MM-dd')
    const ib = formatDate(initialDateRange.to, 'yyyy-MM-dd')
    return a !== ia || b !== ib
  }, [dateRange, initialDateRange])

  const hasActiveFilters =
    !!searchQuery.trim() ||
    filterPlant !== 'all' ||
    filterEstado !== 'pendiente' ||
    filterTipo !== 'all' ||
    rangeDirty

  const clearFilters = () => {
    setSearchQuery('')
    setFilterPlant(currentPlant?.id ?? 'all')
    setFilterEstado('pendiente')
    setFilterTipo('all')
    setDateRange({
      from: initialDateRange.from ? new Date(initialDateRange.from) : undefined,
      to: initialDateRange.to ? new Date(initialDateRange.to) : undefined,
    })
  }

  const stats = useMemo(
    () => ({
      pendiente: filteredEntries.filter((e) => e.estado === 'pendiente').length,
      vencido: filteredEntries.filter((e) => e.estado === 'vencido').length,
      urgente: filteredEntries.filter((e) => e.estado === 'pendiente' && daysUntil(e.fecha_programada) <= 7).length,
    }),
    [filteredEntries],
  )

  const calYear = currentMonth.getFullYear()
  const calMonth = currentMonth.getMonth()
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [calYear, calMonth])

  const dayKey = (day: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const todayStr = localDateKey(new Date())

  const hasComplianceGaps = Boolean(
    gaps && (gaps.fecha_vencidas.length > 0 || gaps.sin_programacion.length > 0),
  )
  const showEmptyHub = !loading && filteredEntries.length === 0 && !hasComplianceGaps

  return (
    <div className="space-y-5">
      <EmaBreadcrumb items={[{ label: 'Programa de calibraciones' }]} />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/80 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
          <p className="flex-1 text-sm text-red-900">{error}</p>
          <Button type="button" variant="outline" size="sm" className="border-red-300 bg-white" onClick={() => void fetchPrograma()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 md:text-2xl">Programa de calibraciones</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-sm text-stone-500">EMA — verificaciones y calibraciones</p>
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
                'h-8 gap-1.5 rounded-md border-stone-300 px-2.5 shadow-none sm:px-3',
                viewMode === 'week' && qualityHubPrimaryButtonClass,
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
                'h-8 gap-1.5 rounded-md border-stone-300 px-2.5 shadow-none sm:px-3',
                viewMode === 'month' && qualityHubPrimaryButtonClass,
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
                'h-8 gap-1.5 rounded-md border-stone-300 px-2.5 shadow-none sm:px-3',
                viewMode === 'day' && qualityHubPrimaryButtonClass,
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
                'h-8 gap-1.5 rounded-md border-stone-300 px-2.5 shadow-none sm:px-3',
                viewMode === 'list' && qualityHubPrimaryButtonClass,
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            aria-label="Actualizar"
          >
            <RefreshCw className={cn('h-4 w-4 text-stone-700', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white p-12 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
          <span className="text-sm text-stone-600">Cargando programa…</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              placeholder="Buscar por código o nombre de instrumento…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 min-h-9 min-w-0 flex-1 border-stone-300 bg-white sm:max-w-md"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-w-[160px] max-w-[260px] justify-start gap-2 border-stone-300 bg-white px-3 font-normal"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-stone-600" />
                  <span className="truncate">{dateRangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto border-0 bg-transparent p-0 shadow-none" align="start">
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
            {(availablePlants ?? []).length > 1 && (
              <Select value={filterPlant} onValueChange={setFilterPlant}>
                <SelectTrigger className="h-9 w-[200px] border-stone-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {(availablePlants ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="h-9 w-40 border-stone-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="completado">Completados</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-9 w-48 border-stone-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="calibracion_externa">Calibración EMA</SelectItem>
                <SelectItem value="verificacion_interna">Verificación interna</SelectItem>
                <SelectItem value="verificacion_post_incidente">Post-incidente</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button type="button" variant="outline" className="h-9 border-stone-300 bg-white" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stats.vencido > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                {stats.vencido} vencido{stats.vencido > 1 ? 's' : ''}
              </span>
            )}
            {stats.urgente > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <Clock className="h-3 w-3" />
                {stats.urgente} urgente{stats.urgente > 1 ? 's' : ''} (≤7d)
              </span>
            )}
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
              {stats.pendiente} pendiente{stats.pendiente !== 1 ? 's' : ''} (vista)
            </span>
          </div>

          {showEmptyHub ? (
            <Card className="border-stone-200">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <CalendarDays className="h-10 w-10 text-stone-400" />
                <p className="text-sm text-stone-600">Sin eventos en el programa para el rango y filtros actuales.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === 'week' && (
                <div className="space-y-4">
                  <ProgramaWeekView
                    entries={filteredEntries}
                    weekStart={weekStart}
                    selectedDate={selectedDate}
                    onWeekStartChange={setWeekStart}
                    onSelectDate={onSelectDate}
                  />
                  <DaySheet
                    selectedDate={selectedDate}
                    items={muestrasForSelectedDay}
                    onNavigate={(id) => router.push(`/quality/instrumentos/${id}`)}
                  />
                </div>
              )}

              {viewMode === 'month' && (
                <div className="space-y-4">
                  <MonthGrid
                    calYear={calYear}
                    calMonth={calMonth}
                    calendarDays={calendarDays}
                    eventsByDate={eventsByDate}
                    selectedDate={selectedDate}
                    onSelectDate={onSelectDate}
                    onPrev={() => setCurrentMonth((d) => addMonths(d, -1))}
                    onNext={() => setCurrentMonth((d) => addMonths(d, 1))}
                    todayStr={todayStr}
                    dayKeyFn={dayKey}
                  />
                  <DaySheet
                    selectedDate={selectedDate}
                    items={muestrasForSelectedDay}
                    onNavigate={(id) => router.push(`/quality/instrumentos/${id}`)}
                  />
                </div>
              )}

              {viewMode === 'day' && selectedDate && (
                <DayNavView
                  selectedDate={selectedDate}
                  items={muestrasForSelectedDay}
                  onPrev={() => onSelectDate(subDays(selectedDate, 1))}
                  onNext={() => onSelectDate(addDays(selectedDate, 1))}
                  onToday={() => onSelectDate(new Date())}
                  onNavigate={(id) => router.push(`/quality/instrumentos/${id}`)}
                />
              )}

              {viewMode === 'list' && (
                <ProgramaListView
                  entries={filteredEntries}
                  gaps={gaps}
                  onOpenInstrument={(id) => router.push(`/quality/instrumentos/${id}`)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function DaySheet({
  selectedDate,
  items,
  onNavigate,
}: {
  selectedDate: Date | undefined
  items: ProgramaCalibacionConInstrumento[]
  onNavigate: (id: string) => void
}) {
  if (!selectedDate) {
    return (
      <p className="text-center text-sm text-stone-500">Selecciona un día en la semana o el mes.</p>
    )
  }
  const label = formatDate(selectedDate, 'EEEE d MMMM yyyy')
  return (
    <Card className="border border-stone-200/90 shadow-sm ring-1 ring-stone-950/[0.02]">
      <div className="border-b border-stone-100 bg-stone-50/80 px-4 py-2 text-sm font-semibold capitalize text-stone-800">
        {label}
      </div>
      <CardContent className="divide-y divide-stone-100 p-0">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Sin eventos este día.</p>
        ) : (
          items.map((e) => <ProgramaEventRow key={e.id} entry={e} onNavigate={onNavigate} />)
        )}
      </CardContent>
    </Card>
  )
}

function DayNavView({
  selectedDate,
  items,
  onPrev,
  onNext,
  onToday,
  onNavigate,
}: {
  selectedDate: Date
  items: ProgramaCalibacionConInstrumento[]
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onNavigate: (id: string) => void
}) {
  return (
    <Card className="border border-stone-200/90 shadow-sm ring-1 ring-stone-950/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-stone-300" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-stone-300" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 border-stone-300" onClick={onToday}>
            Hoy
          </Button>
        </div>
        <span className="text-sm font-semibold capitalize text-stone-800">
          {formatDate(selectedDate, 'EEEE d MMMM yyyy')}
        </span>
      </div>
      <CardContent className="divide-y divide-stone-100 p-0">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Sin eventos este día.</p>
        ) : (
          items.map((e) => <ProgramaEventRow key={e.id} entry={e} onNavigate={onNavigate} />)
        )}
      </CardContent>
    </Card>
  )
}

function MonthGrid({
  calYear,
  calMonth,
  calendarDays,
  eventsByDate,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
  todayStr,
  dayKeyFn,
}: {
  calYear: number
  calMonth: number
  calendarDays: (number | null)[]
  eventsByDate: Map<string, ProgramaCalibacionConInstrumento[]>
  selectedDate: Date | undefined
  onSelectDate: (d: Date | undefined) => void
  onPrev: () => void
  onNext: () => void
  todayStr: string
  dayKeyFn: (day: number) => string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/80 px-4 py-3">
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-stone-900">
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-b border-stone-100">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="min-h-[72px] border-b border-r border-stone-100" />
          }
          const key = dayKeyFn(day)
          const ev = eventsByDate.get(key) ?? []
          const isToday = key === todayStr
          const isSelected = selectedDate ? isSameDay(new Date(key + 'T12:00:00'), selectedDate) : false
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(isSelected ? undefined : new Date(key + 'T12:00:00'))}
              className={cn(
                'min-h-[72px] border-b border-r border-stone-100 p-1.5 text-left transition-colors',
                isToday && 'bg-sky-50',
                isSelected && 'bg-stone-100 ring-1 ring-inset ring-stone-300',
                !isToday && !isSelected && 'hover:bg-stone-50',
              )}
            >
              <div
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday ? 'bg-sky-700 text-white' : 'text-stone-700',
                )}
              >
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {ev.slice(0, 3).map((e) => (
                  <div key={e.id} className={cn('truncate rounded border px-1 py-0.5 text-[10px] font-medium', eventPillClass(e))}>
                    {(e.instrumento as { nombre?: string } | undefined)?.nombre ?? '—'}
                  </div>
                ))}
                {ev.length > 3 && <div className="pl-1 text-[10px] text-stone-400">+{ev.length - 3} más</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProgramaEventRow({
  entry: e,
  onNavigate,
}: {
  entry: ProgramaCalibacionConInstrumento
  onNavigate: (id: string) => void
}) {
  const instrumento = e.instrumento
  const d = daysUntil(e.fecha_programada)
  const isUrgent = e.estado === 'pendiente' && d <= 7 && d >= 0
  const isVencido = e.estado === 'vencido' || (e.estado === 'pendiente' && d < 0)
  const countdownText =
    e.estado === 'completado' || e.estado === 'cancelado'
      ? null
      : d < 0
        ? `${Math.abs(d)}d vencido`
        : d === 0
          ? 'Hoy'
          : `en ${d}d`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => instrumento?.id && onNavigate(instrumento.id)}
      onKeyDown={(ev) => ev.key === 'Enter' && instrumento?.id && onNavigate(instrumento.id)}
      className={cn(
        'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50',
        isVencido && 'bg-red-50/30',
        isUrgent && 'bg-amber-50/30',
      )}
    >
      <div className="min-w-[40px] shrink-0 text-center">
        <div className="text-lg font-bold tabular-nums leading-none text-stone-800">{programaDateKey(e.fecha_programada).split('-')[2]}</div>
        <div className="text-[10px] uppercase text-stone-400">
          {new Date(programaDateKey(e.fecha_programada) + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-stone-900">{instrumento?.nombre ?? '—'}</div>
        <div className="font-mono text-xs text-stone-500">{instrumento?.codigo ?? '—'}</div>
      </div>
      {countdownText && (
        <div className={cn('shrink-0 font-mono text-xs', isVencido ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-stone-400')}>
          {countdownText}
        </div>
      )}
    </div>
  )
}
