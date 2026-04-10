'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { MuestraWithRelations } from '@/types/quality'
import {
  computeAge,
  computeUrgency,
  getScheduledDateTime,
  getScheduledTime,
  getTestWindow,
  groupMuestrasByScheduledDay,
  specimenShortLabel,
  urgencyPillClass,
} from './ensayosHelpers'

export type EnsayosCalendarProps = {
  muestras: MuestraWithRelations[]
  currentMonth: Date
  selectedDate: Date | undefined
  onCurrentMonthChange: (d: Date) => void
  onSelectDate: (d: Date | undefined) => void
}

function dayHasOverdue(samples: MuestraWithRelations[], now: Date) {
  return samples.some((m) => {
    const w = getTestWindow(m)
    return w && now.getTime() > w.end.getTime()
  })
}

const WEEK_STARTS_ON = 0 as const
const MAX_PILLS = 3

export default function EnsayosCalendar({
  muestras,
  currentMonth,
  selectedDate,
  onCurrentMonthChange,
  onSelectDate,
}: EnsayosCalendarProps) {
  const byDay = useMemo(() => groupMuestrasByScheduledDay(muestras), [muestras])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON })
    const days: Date[] = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const title =
    format(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() +
    format(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)

  const goToday = () => {
    const t = new Date()
    onCurrentMonthChange(t)
    onSelectDate(t)
  }

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02] overflow-hidden">
      <CardHeader className="border-b border-stone-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <CalendarDays className="h-5 w-5 text-stone-600 shrink-0" />
            {title}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={goToday}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={() => onCurrentMonthChange(subMonths(currentMonth, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={() => onCurrentMonthChange(addMonths(currentMonth, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-px rounded-lg border border-stone-200 bg-stone-200 overflow-hidden">
          {weekDays.map((d) => (
            <div
              key={d}
              className="bg-stone-50 py-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500"
            >
              {d}
            </div>
          ))}
          {calendarDays.map((day) => {
            const now = new Date()
            const key = format(day, 'yyyy-MM-dd')
            const samples = byDay.get(key) ?? []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isTodayDate = isToday(day)
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
            const overdueDot = dayHasOverdue(samples, now)

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDate(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectDate(day)
                  }
                }}
                className={cn(
                  'flex min-h-[5.5rem] flex-col p-1.5 outline-none transition-colors lg:min-h-[10rem] lg:cursor-pointer lg:p-2',
                  !isCurrentMonth && 'bg-stone-50/50 text-stone-400',
                  isCurrentMonth && 'bg-white',
                  isTodayDate && 'bg-sky-50/40 ring-1 ring-inset ring-sky-500/50',
                  isSelected && 'bg-stone-50 ring-2 ring-stone-900 ring-inset z-[1]',
                  'hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-sky-500/40'
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-1">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isTodayDate && 'font-bold text-sky-700'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {samples.length > 0 && (
                    <div className="flex items-center gap-1">
                      {overdueDot && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          title="Hay ensayos atrasados"
                        />
                      )}
                      <span className="hidden font-mono text-xs tabular-nums text-stone-500 lg:inline">
                        {samples.length}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-1 overflow-hidden lg:flex">
                  {samples.slice(0, MAX_PILLS).map((muestra) => {
                    const time = getScheduledTime(muestra)
                    const age = computeAge(muestra)
                    const { urgency } = computeUrgency(muestra, now)
                    const label = specimenShortLabel(muestra)
                    return (
                      <Link
                        key={muestra.id}
                        href={`/quality/ensayos/new?muestra=${muestra.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight text-stone-800',
                          urgencyPillClass(urgency)
                        )}
                      >
                        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums">
                          {time ?? (
                            <span className="text-stone-400">--:--</span>
                          )}
                        </span>
                        <span className="min-w-0 truncate text-stone-700">{label}</span>
                        {age && (
                          <span className="shrink-0 font-mono text-[10px] text-stone-500">
                            {age.label}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                  {samples.length > MAX_PILLS && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectDate(day)
                      }}
                      className="text-left text-[10px] font-medium text-sky-800 hover:underline"
                    >
                      +{samples.length - MAX_PILLS} más
                    </button>
                  )}
                </div>

                {samples.length > 0 && (
                  <div className="mt-auto pt-1 text-center lg:hidden">
                    <span className="font-mono text-xs font-semibold tabular-nums text-stone-600">
                      {samples.length} ens.
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
