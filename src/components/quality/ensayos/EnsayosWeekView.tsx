'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { MuestraWithRelations } from '@/types/quality'
import {
  computeAge,
  computeUrgency,
  formatTestWindowClockRange,
  getScheduledDateTime,
  getPrimaryScheduledClock,
  getTestWindow,
  groupMuestrasByScheduledDay,
  specimenShortLabel,
  urgencyPillClass,
} from './ensayosHelpers'

const WEEK_STARTS_ON = 0 as const

export type EnsayosWeekViewProps = {
  muestras: MuestraWithRelations[]
  weekStart: Date
  selectedDate: Date | undefined
  onWeekStartChange: (d: Date) => void
  onSelectDate: (d: Date | undefined) => void
}

function dayHasOverdue(samples: MuestraWithRelations[], now: Date) {
  return samples.some((m) => {
    const w = getTestWindow(m)
    return w && now.getTime() > w.end.getTime()
  })
}

const MAX_PILLS = 8

export default function EnsayosWeekView({
  muestras,
  weekStart,
  selectedDate,
  onWeekStartChange,
  onSelectDate,
}: EnsayosWeekViewProps) {
  const byDay = useMemo(() => groupMuestrasByScheduledDay(muestras), [muestras])

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  const rangeLabel = `${format(weekDays[0]!, 'd MMM', { locale: es })} – ${format(
    weekDays[6]!,
    "d MMM yyyy",
    { locale: es }
  )}`

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
            <CalendarDays className="h-5 w-5 text-stone-600 shrink-0" />
            <span className="capitalize">{rangeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
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
            const now = new Date()
            const key = format(day, 'yyyy-MM-dd')
            const samples = byDay.get(key) ?? []
            const isTodayDate = isToday(day)
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
            const overdueDot = dayHasOverdue(samples, now)

            return (
              <div
                key={key}
                className={cn(
                  'flex min-w-[140px] shrink-0 flex-col rounded-lg border border-stone-200 bg-white lg:min-w-0',
                  isTodayDate && 'ring-1 ring-sky-500/40 bg-sky-50/30',
                  isSelected && 'ring-2 ring-stone-900'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'flex w-full flex-col border-b border-stone-100 px-2 py-2 text-left transition-colors hover:bg-stone-50/80',
                    isTodayDate && 'bg-sky-50/50'
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span
                    className={cn(
                      'text-base font-semibold tabular-nums',
                      isTodayDate ? 'text-sky-800' : 'text-stone-900'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 flex items-center gap-1">
                    {samples.length > 0 && (
                      <>
                        {overdueDot && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                            title="Hay ensayos atrasados"
                          />
                        )}
                        <span className="font-mono text-xs tabular-nums text-stone-500">
                          {samples.length}
                        </span>
                      </>
                    )}
                  </div>
                </button>
                <div className="flex min-h-[8rem] flex-1 flex-col gap-1 p-1.5 lg:min-h-[12rem]">
                  {samples.slice(0, MAX_PILLS).map((muestra) => {
                    const pc = getPrimaryScheduledClock(muestra)
                    const win = getTestWindow(muestra)
                    const sched = getScheduledDateTime(muestra)
                    const age = computeAge(muestra)
                    const { urgency } = computeUrgency(muestra, now)
                    const label = specimenShortLabel(muestra)
                    const titleParts = [
                      pc ? `Programada ${pc.clock}${pc.isApprox ? ' (aprox.)' : ''}` : null,
                      win
                        ? `Ventana ${formatTestWindowClockRange(win, sched ?? undefined)}`
                        : null,
                    ].filter(Boolean)
                    return (
                      <Link
                        key={muestra.id}
                        href={`/quality/ensayos/new?muestra=${muestra.id}`}
                        title={titleParts.length ? titleParts.join(' · ') : undefined}
                        className={cn(
                          'flex flex-col gap-0.5 rounded px-1.5 py-1 text-[11px] leading-tight text-stone-800',
                          urgencyPillClass(urgency)
                        )}
                      >
                        <span className="font-mono text-[11px] font-semibold tabular-nums">
                          {pc?.clock ?? <span className="text-stone-400">--:--</span>}
                        </span>
                        {win && (
                          <span className="truncate font-mono text-[9px] font-normal tabular-nums text-stone-500">
                            {formatTestWindowClockRange(win, sched ?? undefined)}
                          </span>
                        )}
                        <span className="truncate text-stone-700">{label}</span>
                        {age && (
                          <span className="font-mono text-[10px] text-stone-500">{age.label}</span>
                        )}
                      </Link>
                    )
                  })}
                  {samples.length > MAX_PILLS && (
                    <button
                      type="button"
                      onClick={() => onSelectDate(day)}
                      className="text-left text-[10px] font-medium text-sky-800 hover:underline"
                    >
                      +{samples.length - MAX_PILLS} más
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
