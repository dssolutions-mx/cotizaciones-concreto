'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format, isSameDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import type { MuestraWithRelations } from '@/types/quality'
import {
  computeAge,
  computeUrgency,
  formatClockLocal,
  formatToleranceLabel,
  getPrimaryScheduledClock,
  getScheduledDateTime,
  getTestWindow,
  sortMuestrasByScheduledTime,
  specimenTypeLabel,
  urgencyBadgeClass,
  urgencyTimelineCardBorderClass,
} from './ensayosHelpers'

/** Full day so 01:05 and 23:30 align with the grid (matches mental model of “hora del ensayo”). */
const DAY_START_HOUR = 0
const DAY_END_HOUR = 24
const HOUR_PX = 40
/** Fixed mapping: 24h × HOUR_PX — do not rescale when the canvas grows for stacked cards. */
const TIME_AXIS_PX = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX
const MINUTES_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * 60
const CARD_MIN_HEIGHT = 128
const COLLISION_STEP = 8

export type EnsayosDayViewProps = {
  selectedDate: Date | undefined
  muestrasForDay: MuestraWithRelations[]
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
}

function minutesSinceDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function overlaps(aTop: number, aH: number, bTop: number, bH: number): boolean {
  return aTop < bTop + bH && aTop + aH > bTop
}

function placeItemsOnTimeAxis(
  sorted: MuestraWithRelations[],
  selectedDate: Date | undefined,
  timeAxisPx: number
) {
  const now = new Date()
  const items = sorted
    .map((m) => {
      const sched = getScheduledDateTime(m)
      if (!sched || (selectedDate && !isSameDay(sched, selectedDate))) return null
      const mins = minutesSinceDayStart(sched)
      const baseTop = (mins / MINUTES_PER_DAY) * timeAxisPx
      return { m, sched, mins, win: getTestWindow(m), baseTop, now }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.mins - b.mins)

  const intervals: { top: number; bottom: number }[] = []
  const placed = items.map((item) => {
    let top = item.baseTop
    while (
      intervals.some((iv) => overlaps(top, CARD_MIN_HEIGHT, iv.top, iv.bottom - iv.top))
    ) {
      top += COLLISION_STEP
    }
    const bottom = top + CARD_MIN_HEIGHT
    intervals.push({ top, bottom })
    return { ...item, top }
  })
  const maxBottom = placed.length ? Math.max(...placed.map((p) => p.top + CARD_MIN_HEIGHT)) : 0
  return { placed, maxBottom }
}

export default function EnsayosDayView({
  selectedDate,
  muestrasForDay,
  onPrevDay,
  onNextDay,
  onToday,
}: EnsayosDayViewProps) {
  const sorted = useMemo(
    () => sortMuestrasByScheduledTime(muestrasForDay, new Date()),
    [muestrasForDay]
  )

  const { placed, timelineHeight } = useMemo(() => {
    const { placed: p, maxBottom } = placeItemsOnTimeAxis(sorted, selectedDate, TIME_AXIS_PX)
    return {
      placed: p,
      timelineHeight: Math.max(TIME_AXIS_PX, maxBottom + 24),
    }
  }, [sorted, selectedDate])

  const nowTopPx = useMemo(() => {
    if (!selectedDate || !isToday(selectedDate)) return null
    const now = new Date()
    const mins = minutesSinceDayStart(now)
    return (mins / MINUTES_PER_DAY) * TIME_AXIS_PX
  }, [selectedDate])

  if (!selectedDate) return null

  const now = new Date()
  const title = formatDate(selectedDate, "EEEE d 'de' MMMM, yyyy")

  const hourLabels = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i
  )

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02] overflow-hidden">
      <CardHeader className="border-b border-stone-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Clock className="h-5 w-5 text-stone-600 shrink-0" />
            <span className="capitalize">{title}</span>
            <Badge variant="outline" className="border-stone-200 bg-stone-50 font-mono text-stone-700">
              {sorted.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={onToday}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={onPrevDay}
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={onNextDay}
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-stone-500">
          Cada tarjeta se coloca a la hora programada del ensayo. La línea roja punteada es la hora actual.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Clock className="mb-3 h-12 w-12 text-stone-300" />
            <h3 className="text-lg font-medium text-stone-900">Sin ensayos programados</h3>
            <p className="mt-1 max-w-md text-sm text-stone-500">
              No hay ensayos pendientes para {format(selectedDate, 'PPP', { locale: es })}.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(70vh,900px)] overflow-y-auto overflow-x-hidden">
            <div className="relative flex min-h-0">
              <div
                className="sticky left-0 z-10 flex shrink-0 flex-col border-r border-stone-200 bg-stone-50/90"
                style={{ height: timelineHeight }}
              >
                {hourLabels.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end border-b border-stone-100/90 pr-2 pt-0.5 text-[11px] font-mono tabular-nums text-stone-500"
                    style={{ height: HOUR_PX }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
                {timelineHeight > TIME_AXIS_PX && (
                  <div
                    className="flex shrink-0 items-start justify-end border-t border-dashed border-stone-200 bg-stone-50/50 pr-2 pt-1 text-[10px] leading-tight text-stone-400"
                    style={{ height: timelineHeight - TIME_AXIS_PX }}
                  >
                    Más tarde / apilado
                  </div>
                )}
              </div>
              <div className="relative min-w-0 flex-1 bg-stone-50/20" style={{ height: timelineHeight }}>
                {hourLabels.map((h) => (
                  <div
                    key={`g-${h}`}
                    className="pointer-events-none absolute left-0 right-0 border-b border-stone-100/80"
                    style={{ top: h * HOUR_PX }}
                  />
                ))}
                {timelineHeight > TIME_AXIS_PX && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgb(231_229_228/0.35)_6px,rgb(231_229_228/0.35)_7px)]"
                    style={{ top: TIME_AXIS_PX, height: timelineHeight - TIME_AXIS_PX }}
                  />
                )}
                {nowTopPx != null && nowTopPx >= 0 && nowTopPx <= timelineHeight && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-dashed border-red-400/90"
                    style={{ top: nowTopPx }}
                    title="Hora actual"
                  />
                )}
                {placed.map(({ m: muestra, sched, win, top }) => {
                  const pc = getPrimaryScheduledClock(muestra)
                  const primaryTime = pc?.clock ?? formatClockLocal(sched)
                  const hasExactTs = pc ? !pc.isApprox : false
                  const age = computeAge(muestra)
                  const { urgency, label: urgencyLabel } = computeUrgency(muestra, now)
                  const overdueRow =
                    win && now.getTime() > win.end.getTime() ? 'bg-red-50/50' : ''
                  const rem = muestra.muestreo?.remision?.remision_number
                  const recipeCode = muestra.muestreo?.remision?.recipe?.recipe_code
                  const fc = muestra.muestreo?.remision?.recipe?.strength_fc

                  return (
                    <div
                      key={muestra.id}
                      className={cn(
                        'absolute left-2 right-2 z-[5] rounded-lg border bg-white p-2.5 pl-3 shadow-sm ring-1 ring-stone-950/[0.04]',
                        overdueRow || 'border-stone-200',
                        urgencyTimelineCardBorderClass(urgency)
                      )}
                      style={{ top, minHeight: CARD_MIN_HEIGHT - 16 }}
                    >
                      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <p className="font-mono text-lg font-bold tabular-nums leading-none text-stone-900">
                              {primaryTime}
                            </p>
                            {win && (
                              <span className="text-[11px] text-stone-500">
                                {formatToleranceLabel(win.toleranceMinutes)}
                              </span>
                            )}
                          </div>
                          {!hasExactTs && (
                            <p className="mt-0.5 text-[10px] text-amber-700">
                              Aprox. (sin marca de tiempo exacta en sistema)
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 text-[10px] font-medium', urgencyBadgeClass(urgency))}
                        >
                          {urgencyLabel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-stone-900">
                            {muestra.identificacion?.trim() || muestra.id.substring(0, 8)}
                          </div>
                          <Badge
                            variant="outline"
                            className="mt-1 border-stone-200 text-[10px] text-stone-700"
                          >
                            {specimenTypeLabel(muestra.tipo_muestra)}
                          </Badge>
                          {age && (
                            <span className="ml-2 font-mono text-xs text-stone-600">{age.label}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        Rem. {rem ?? '—'}
                        {recipeCode ? ` · ${recipeCode}` : ''}
                        {fc != null ? ` · ${fc} kg/cm²` : ''}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          asChild
                          className={cn(qualityHubPrimaryButtonClass, 'h-8 px-3 text-xs')}
                        >
                          <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Realizar ensayo
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
