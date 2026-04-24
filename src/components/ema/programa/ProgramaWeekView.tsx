'use client'

import { useMemo } from 'react'
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProgramaCalibacionConInstrumento } from '@/types/ema'
import { eventPillClass, groupProgramaByDay, programaDateKey, daysUntil } from './programaHelpers'

const WEEK_STARTS_ON = 0 as const
const MAX_PILLS = 6

export type ProgramaWeekViewProps = {
  entries: ProgramaCalibacionConInstrumento[]
  weekStart: Date
  selectedDate: Date | undefined
  onWeekStartChange: (d: Date) => void
  onSelectDate: (d: Date | undefined) => void
}

function dayHasUrgentOrVencido(items: ProgramaCalibacionConInstrumento[]) {
  return items.some((e) => {
    if (e.estado === 'vencido') return true
    if (e.estado === 'pendiente' && daysUntil(e.fecha_programada) < 0) return true
    if (e.estado === 'pendiente' && daysUntil(e.fecha_programada) <= 7) return true
    return false
  })
}

export default function ProgramaWeekView({
  entries,
  weekStart,
  selectedDate,
  onWeekStartChange,
  onSelectDate,
}: ProgramaWeekViewProps) {
  const byDay = useMemo(() => groupProgramaByDay(entries), [entries])

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  const rangeLabel = `${format(weekDays[0]!, 'd MMM', { locale: es })} – ${format(weekDays[6]!, 'd MMM yyyy', { locale: es })}`

  const goThisWeek = () => {
    const t = new Date()
    onWeekStartChange(startOfWeek(t, { weekStartsOn: WEEK_STARTS_ON }))
    onSelectDate(t)
  }

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02] overflow-hidden">
      <CardHeader className="border-b border-stone-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <CalendarDays className="h-5 w-5 shrink-0 text-stone-600" />
            <span className="capitalize">{rangeLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={goThisWeek}
            >
              Esta semana
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={() => onWeekStartChange(addWeeks(weekStart, -1))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={() => onWeekStartChange(addWeeks(weekStart, 1))}
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0">
          {weekDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const items = byDay.get(key) ?? []
            const isTodayDate = isToday(day)
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
            const hot = dayHasUrgentOrVencido(items)

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(isSelected ? undefined : day)}
                className={cn(
                  'min-w-[140px] flex-1 rounded-lg border p-2 text-left transition-colors lg:min-w-0',
                  'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80',
                  isTodayDate && 'ring-1 ring-sky-300/80',
                  isSelected && 'border-sky-400 bg-sky-50/50 ring-1 ring-sky-400/40',
                  hot && 'border-amber-200/90',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-[11px] font-semibold uppercase text-stone-500', isTodayDate && 'text-sky-800')}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      isTodayDate ? 'bg-sky-700 text-white' : 'text-stone-800',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {items.slice(0, MAX_PILLS).map((e) => {
                    const inst = (e as { instrumento?: { nombre?: string } }).instrumento
                    return (
                      <div
                        key={e.id}
                        className={cn('truncate rounded border px-1 py-0.5 text-[10px] font-medium', eventPillClass(e))}
                        title={inst?.nombre ?? programaDateKey(e.fecha_programada)}
                      >
                        {inst?.nombre ?? '—'}
                      </div>
                    )
                  })}
                  {items.length > MAX_PILLS && (
                    <div className="text-[10px] text-stone-400">+{items.length - MAX_PILLS} más</div>
                  )}
                  {items.length === 0 && <div className="text-[10px] text-stone-300">—</div>}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
