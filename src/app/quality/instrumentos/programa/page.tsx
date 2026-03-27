'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import type { ProgramaCalibacionConInstrumento, EstadoPrograma } from '@/types/ema'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_EVENTO_LABEL: Record<string, string> = {
  calibracion_externa: 'Calibración EMA',
  verificacion_interna: 'Verificación interna',
  verificacion_post_incidente: 'Post-incidente',
}

const ESTADO_STYLE: Record<EstadoPrograma, { pill: string; dot: string; label: string; icon: React.ReactNode }> = {
  pendiente: {
    pill: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-400',
    label: 'Pendiente',
    icon: <Clock className="h-3 w-3" />,
  },
  completado: {
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-400',
    label: 'Completado',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  vencido: {
    pill: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    label: 'Vencido',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  cancelado: {
    pill: 'bg-stone-100 text-stone-500 border-stone-200',
    dot: 'bg-stone-300',
    label: 'Cancelado',
    icon: <XCircle className="h-3 w-3" />,
  },
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86_400_000)
}

function eventPillClass(entry: ProgramaCalibacionConInstrumento): string {
  if (entry.estado === 'completado') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (entry.estado === 'cancelado') return 'bg-stone-100 text-stone-500 border-stone-200'
  if (entry.estado === 'vencido') return 'bg-red-100 text-red-800 border-red-200'
  const d = daysUntil(entry.fecha_programada)
  if (d <= 7) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-sky-100 text-sky-800 border-sky-200'
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramaPage() {
  const router = useRouter()
  const { currentPlant, availablePlants } = usePlantContext()

  const [entries, setEntries] = useState<ProgramaCalibacionConInstrumento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'calendario' | 'lista'>('lista')

  // Filters
  const [filterPlant, setFilterPlant] = useState(currentPlant?.id ?? 'all')
  const [filterEstado, setFilterEstado] = useState('pendiente')
  const [filterTipo, setFilterTipo] = useState('all')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Calendar state
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const fetchPrograma = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterPlant !== 'all') params.set('plant_id', filterPlant)
      if (filterEstado !== 'all') params.set('estado', filterEstado)
      if (filterTipo !== 'all') params.set('tipo_evento', filterTipo)
      if (fechaDesde) params.set('fecha_desde', fechaDesde)
      if (fechaHasta) params.set('fecha_hasta', fechaHasta)
      const res = await fetch(`/api/ema/programa?${params}`)
      if (!res.ok) throw new Error('Error cargando programa')
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterPlant, filterEstado, filterTipo, fechaDesde, fechaHasta])

  useEffect(() => { fetchPrograma() }, [fetchPrograma])

  // Stats
  const stats = useMemo(() => ({
    pendiente: entries.filter(e => e.estado === 'pendiente').length,
    vencido: entries.filter(e => e.estado === 'vencido').length,
    completado: entries.filter(e => e.estado === 'completado').length,
    urgente: entries.filter(e => e.estado === 'pendiente' && daysUntil(e.fecha_programada) <= 7).length,
  }), [entries])

  // Grouped by month (for list view)
  const grouped = useMemo(() => {
    const map = new Map<string, ProgramaCalibacionConInstrumento[]>()
    for (const e of entries) {
      const month = e.fecha_programada.substring(0, 7)
      if (!map.has(month)) map.set(month, [])
      map.get(month)!.push(e)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [entries])

  // Events by date (for calendar view)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ProgramaCalibacionConInstrumento[]>()
    for (const e of entries) {
      const d = e.fecha_programada.split('T')[0]
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return map
  }, [entries])

  // Calendar grid days for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay() // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [calYear, calMonth])

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedDayEvents = selectedDay ? (eventsByDate.get(selectedDay) ?? []) : []

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <EmaBreadcrumb items={[{ label: 'Programa de calibraciones' }]} />

      {/* Header */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Programa de calibraciones
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {loading ? 'Cargando…' : `${entries.length} evento${entries.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex rounded-md border border-stone-200 overflow-hidden">
              <button
                onClick={() => setView('lista')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'lista'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                )}
              >
                <List className="h-3 w-3" /> Lista
              </button>
              <button
                onClick={() => setView('calendario')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-stone-200',
                  view === 'calendario'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                )}
              >
                <CalendarDays className="h-3 w-3" /> Calendario
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={fetchPrograma}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {stats.vencido > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {stats.vencido} vencido{stats.vencido > 1 ? 's' : ''}
            </span>
          )}
          {stats.urgente > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stats.urgente} urgente{stats.urgente > 1 ? 's' : ''} (≤7d)
            </span>
          )}
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {stats.pendiente} pendiente{stats.pendiente !== 1 ? 's' : ''}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {stats.completado} completado{stats.completado !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-stone-200 bg-white p-3 flex flex-wrap gap-2 items-center">
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="h-8 w-36 text-xs border-stone-200">
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
          <SelectTrigger className="h-8 w-48 text-xs border-stone-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TIPO_EVENTO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(availablePlants ?? []).length > 1 && (
          <Select value={filterPlant} onValueChange={setFilterPlant}>
            <SelectTrigger className="h-8 w-44 text-xs border-stone-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {(availablePlants ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-36 text-xs border-stone-200"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
          />
          <span className="text-stone-400 text-xs">—</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs border-stone-200"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : view === 'calendario' ? (
        <CalendarView
          calYear={calYear}
          calMonth={calMonth}
          calendarDays={calendarDays}
          eventsByDate={eventsByDate}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          selectedDayEvents={selectedDayEvents}
          onPrev={prevMonth}
          onNext={nextMonth}
          onNavigate={id => router.push(`/quality/instrumentos/${id}`)}
        />
      ) : (
        <ListView
          grouped={grouped}
          onNavigate={id => router.push(`/quality/instrumentos/${id}`)}
        />
      )}
    </div>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({
  calYear, calMonth, calendarDays, eventsByDate,
  selectedDay, setSelectedDay, selectedDayEvents,
  onPrev, onNext, onNavigate,
}: {
  calYear: number
  calMonth: number
  calendarDays: (number | null)[]
  eventsByDate: Map<string, ProgramaCalibacionConInstrumento[]>
  selectedDay: string | null
  setSelectedDay: (d: string | null) => void
  selectedDayEvents: ProgramaCalibacionConInstrumento[]
  onPrev: () => void
  onNext: () => void
  onNavigate: (id: string) => void
}) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  function dayKey(day: number): string {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
        <button
          onClick={onPrev}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-stone-900">
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <button
          onClick={onNext}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="border-b border-r border-stone-100 min-h-[72px]" />
          }
          const key = dayKey(day)
          const events = eventsByDate.get(key) ?? []
          const isToday = key === todayStr
          const isSelected = key === selectedDay
          const hasUrgent = events.some(e => e.estado === 'pendiente' && daysUntil(e.fecha_programada) <= 7)
          const hasVencido = events.some(e => e.estado === 'vencido')

          return (
            <div
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={cn(
                'border-b border-r border-stone-100 min-h-[72px] p-1.5 cursor-pointer transition-colors',
                isToday && 'bg-sky-50',
                isSelected && 'bg-stone-100 ring-1 ring-inset ring-stone-300',
                !isToday && !isSelected && 'hover:bg-stone-50',
              )}
            >
              <div className={cn(
                'text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full',
                isToday ? 'bg-sky-600 text-white' : 'text-stone-600',
              )}>
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {events.slice(0, 3).map((e, i) => (
                  <div
                    key={e.id}
                    className={cn(
                      'rounded px-1 py-0.5 text-[10px] font-medium truncate border',
                      eventPillClass(e)
                    )}
                  >
                    {(e.instrumento as any)?.nombre ?? '—'}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-[10px] text-stone-400 pl-1">+{events.length - 3} más</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day events */}
      {selectedDay && selectedDayEvents.length > 0 && (
        <div className="border-t border-stone-200 bg-stone-50/80">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-200">
            {selectedDay} — {selectedDayEvents.length} evento{selectedDayEvents.length > 1 ? 's' : ''}
          </div>
          <div className="divide-y divide-stone-100">
            {selectedDayEvents.map(e => (
              <EventRow key={e.id} entry={e} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  grouped,
  onNavigate,
}: {
  grouped: [string, ProgramaCalibacionConInstrumento[]][]
  onNavigate: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {grouped.map(([month, items]) => (
        <div key={month} className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-600 capitalize">
              {monthLabel(month)}
            </span>
            <span className="text-xs text-stone-400">{items.length} evento{items.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-stone-100">
            {items.map(e => (
              <EventRow key={e.id} entry={e} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({
  entry: e,
  onNavigate,
}: {
  entry: ProgramaCalibacionConInstrumento
  onNavigate: (id: string) => void
}) {
  const instrumento = (e as any).instrumento
  const days = daysUntil(e.fecha_programada)
  const cfg = ESTADO_STYLE[e.estado]
  const isUrgent = e.estado === 'pendiente' && days <= 7 && days >= 0
  const isVencido = e.estado === 'vencido' || (e.estado === 'pendiente' && days < 0)

  const countdownColor = isVencido
    ? 'text-red-600'
    : isUrgent
    ? 'text-amber-600'
    : 'text-stone-400'

  const countdownText =
    e.estado === 'completado' ? null :
    e.estado === 'cancelado' ? null :
    days < 0 ? `${Math.abs(days)}d vencido` :
    days === 0 ? 'Hoy' :
    `en ${days}d`

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors',
        isVencido && 'bg-red-50/30',
        isUrgent && 'bg-amber-50/30',
      )}
      onClick={() => instrumento?.id && onNavigate(instrumento.id)}
    >
      {/* Day block */}
      <div className="text-center min-w-[40px] shrink-0">
        <div className="text-lg font-bold tabular-nums leading-none text-stone-800">
          {e.fecha_programada.split('-')[2]}
        </div>
        <div className="text-[10px] text-stone-400 uppercase">
          {new Date(e.fecha_programada + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' })}
        </div>
      </div>

      {/* Estado dot */}
      <div className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />

      {/* Instrument info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 truncate">
          {instrumento?.nombre ?? '—'}
        </div>
        <div className="font-mono text-xs text-stone-500">
          {instrumento?.codigo} · {TIPO_EVENTO_LABEL[e.tipo_evento] ?? e.tipo_evento}
        </div>
      </div>

      {/* Countdown */}
      {countdownText && (
        <div className={cn('font-mono text-xs shrink-0', countdownColor)}>
          {countdownText}
        </div>
      )}

      {/* Estado badge */}
      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 shrink-0', cfg.pill)}>
        {cfg.icon}
        {cfg.label}
      </span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden animate-pulse">
      <div className="h-10 bg-stone-100 border-b border-stone-200" />
      <div className="divide-y divide-stone-100">
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 space-y-1">
              <div className="h-5 w-8 bg-stone-200 rounded mx-auto" />
              <div className="h-2.5 w-6 bg-stone-100 rounded mx-auto" />
            </div>
            <div className="h-2 w-2 rounded-full bg-stone-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-48 bg-stone-200 rounded" />
              <div className="h-2.5 w-32 bg-stone-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-stone-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
        <CalendarDays className="h-6 w-6 text-stone-400" />
      </div>
      <div>
        <div className="text-sm font-medium text-stone-900">Sin eventos en el programa</div>
        <div className="mt-1 text-xs text-stone-500">Ajusta los filtros para ver más eventos.</div>
      </div>
    </div>
  )
}
