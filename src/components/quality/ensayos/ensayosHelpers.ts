import { differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns'
import { createSafeDate } from '@/lib/utils'
import type { MuestraWithRelations } from '@/types/quality'

export type Urgency = 'overdue' | 'critical' | 'soon' | 'today' | 'upcoming' | 'future'

export type ComputedAge = { value: number; unit: 'h' | 'd'; label: string }

const MS_MIN = 60_000
const MS_HOUR = 60 * MS_MIN
const MS_DAY = 24 * MS_HOUR

/** Tolerance in minutes from guarantee-age rules (by age of concrete at test, in hours). */
export function getToleranceMinutes(ageInHours: number): number {
  if (!Number.isFinite(ageInHours) || ageInHours <= 0) return 30
  if (ageInHours <= 24) return 30
  if (ageInHours <= 72) return 120
  if (ageInHours <= 168) return 360
  if (ageInHours <= 336) return 720
  if (ageInHours <= 672) return 1200
  return 2880
}

export function formatToleranceLabel(minutes: number): string {
  if (minutes < 60) return `±${minutes} min`
  if (minutes % 60 === 0) return `±${minutes / 60}h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `±${h}h ${m}m`
}

/** HH:mm in local time (for labels). */
export function formatClockLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Human-readable allowed window (start–end clocks).
 * When the window starts on a different calendar day than the scheduled test (e.g. ±6h before 01:05),
 * labels the start time with "(día ant.)" so operators do not read it as same-day backwards time.
 */
export function formatTestWindowClockRange(
  win: { start: Date; end: Date },
  scheduledDate?: Date
): string {
  const startClock = formatClockLocal(win.start)
  const endClock = formatClockLocal(win.end)
  const startLabel =
    scheduledDate && win.start.toDateString() !== scheduledDate.toDateString()
      ? `${startClock} (día ant.)`
      : startClock
  return `${startLabel} – ${endClock}`
}

function muestreoBaseDate(muestra: MuestraWithRelations): Date | null {
  const m = muestra.muestreo as { fecha_muestreo_ts?: string; fecha_muestreo?: string; hora_muestreo?: string } | undefined
  if (!m) return null
  if (m.fecha_muestreo_ts) {
    const d = createSafeDate(m.fecha_muestreo_ts)
    if (d) return d
  }
  if (m.fecha_muestreo) {
    const t = m.hora_muestreo || '12:00:00'
    const d = createSafeDate(`${m.fecha_muestreo}T${t.length === 5 ? `${t}:00` : t}`)
    if (d) return d
  }
  return null
}

export function getScheduledDateTime(muestra: MuestraWithRelations): Date | null {
  if (muestra.fecha_programada_ensayo_ts) {
    const d = createSafeDate(muestra.fecha_programada_ensayo_ts)
    if (d) return d
  }
  return createSafeDate(muestra.fecha_programada_ensayo)
}

/** HH:mm in local time, or null if only date field exists (no timestamp). */
export function getScheduledTime(muestra: MuestraWithRelations): string | null {
  if (!muestra.fecha_programada_ensayo_ts) return null
  const d = createSafeDate(muestra.fecha_programada_ensayo_ts)
  if (!d) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Clock to show as “hora programada”: exact from timestamp when available; otherwise clock from
 * parsed scheduled date (approximate if the backend only stores a date).
 */
export function getPrimaryScheduledClock(muestra: MuestraWithRelations): {
  clock: string
  isApprox: boolean
} | null {
  const sched = getScheduledDateTime(muestra)
  if (!sched) return null
  const fromTs = getScheduledTime(muestra)
  if (fromTs) return { clock: fromTs, isApprox: false }
  return { clock: formatClockLocal(sched), isApprox: true }
}

export function computeAge(muestra: MuestraWithRelations): ComputedAge | null {
  const base = muestreoBaseDate(muestra)
  const target = getScheduledDateTime(muestra)
  if (!base || !target) return null
  const ms = target.getTime() - base.getTime()
  if (ms < 0) return { value: 0, unit: 'h', label: '0h' }
  const hours = ms / MS_HOUR
  if (hours <= 48) {
    const rounded = Math.round(hours)
    return { value: rounded, unit: 'h', label: `${rounded}h` }
  }
  const days = Math.round(ms / MS_DAY)
  return { value: days, unit: 'd', label: `${days}d` }
}

export function ageInHoursAtTest(muestra: MuestraWithRelations): number {
  const base = muestreoBaseDate(muestra)
  const target = getScheduledDateTime(muestra)
  if (!base || !target) return 24
  const ms = Math.max(0, target.getTime() - base.getTime())
  return Math.max(ms / MS_HOUR, 0.5)
}

export function getTestWindow(muestra: MuestraWithRelations): { start: Date; end: Date; toleranceMinutes: number } | null {
  const scheduled = getScheduledDateTime(muestra)
  if (!scheduled) return null
  const tol = getToleranceMinutes(ageInHoursAtTest(muestra))
  return {
    start: new Date(scheduled.getTime() - tol * MS_MIN),
    end: new Date(scheduled.getTime() + tol * MS_MIN),
    toleranceMinutes: tol,
  }
}

export function computeUrgency(muestra: MuestraWithRelations, now = new Date()): {
  urgency: Urgency
  label: string
} {
  const scheduled = getScheduledDateTime(muestra)
  if (!scheduled) return { urgency: 'upcoming', label: 'Programado' }

  const win = getTestWindow(muestra)
  const windowEnd = win?.end ?? scheduled
  if (now.getTime() > windowEnd.getTime()) {
    return { urgency: 'overdue', label: 'Atrasado' }
  }

  const toScheduled = scheduled.getTime() - now.getTime()
  const toEnd = windowEnd.getTime() - now.getTime()
  const thirty = 30 * MS_MIN

  if (
    (toScheduled > 0 && toScheduled <= thirty) ||
    (now.getTime() >= scheduled.getTime() && toEnd > 0 && toEnd <= thirty)
  ) {
    return { urgency: 'critical', label: 'Urgente' }
  }

  if (toScheduled > 0 && toScheduled <= 2 * MS_HOUR) {
    return { urgency: 'soon', label: 'Pronto' }
  }

  if (now.getTime() >= scheduled.getTime() && now.getTime() <= windowEnd.getTime()) {
    return { urgency: 'soon', label: 'Pronto' }
  }

  if (isSameDay(scheduled, now)) {
    return { urgency: 'today', label: 'Hoy' }
  }

  const days = differenceInCalendarDays(startOfDay(scheduled), startOfDay(now))
  if (days >= 0 && days <= 7) {
    return { urgency: 'upcoming', label: 'Programado' }
  }

  return { urgency: 'future', label: 'Futuro' }
}

export function urgencyBadgeClass(urgency: Urgency): string {
  switch (urgency) {
    case 'overdue':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-800 animate-pulse'
    case 'soon':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 'today':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'upcoming':
      return 'border-stone-200 bg-stone-50 text-stone-700'
    case 'future':
    default:
      return 'border-stone-100 bg-stone-50 text-stone-500'
  }
}

/** Left accent on day-view timeline cards (matches urgency semantics of pills). */
export function urgencyTimelineCardBorderClass(urgency: Urgency): string {
  switch (urgency) {
    case 'overdue':
    case 'critical':
      return 'border-l-[3px] border-l-red-400'
    case 'soon':
      return 'border-l-[3px] border-l-amber-400'
    case 'today':
      return 'border-l-[3px] border-l-sky-500'
    case 'upcoming':
    case 'future':
    default:
      return 'border-l-[3px] border-l-stone-200'
  }
}

export function urgencyPillClass(urgency: Urgency): string {
  switch (urgency) {
    case 'overdue':
      return 'bg-red-50 border-l-2 border-red-400'
    case 'critical':
      return 'bg-red-50 border-l-2 border-red-400'
    case 'soon':
      return 'bg-amber-50 border-l-2 border-amber-400'
    case 'today':
      return 'bg-sky-50/80'
    case 'upcoming':
    case 'future':
    default:
      return 'bg-stone-50'
  }
}

export function sortMuestrasByScheduledTime(muestras: MuestraWithRelations[], now = new Date()): MuestraWithRelations[] {
  return [...muestras].sort((a, b) => {
    const da = getScheduledDateTime(a)
    const db = getScheduledDateTime(b)
    const ta = da?.getTime() ?? 0
    const tb = db?.getTime() ?? 0

    const wa = getTestWindow(a)
    const wb = getTestWindow(b)
    const overdueA = wa && now.getTime() > wa.end.getTime()
    const overdueB = wb && now.getTime() > wb.end.getTime()
    if (overdueA !== overdueB) return overdueA ? -1 : 1

    return ta - tb
  })
}

export function specimenShortLabel(muestra: MuestraWithRelations): string {
  const id = muestra.identificacion?.trim() || muestra.id.substring(0, 8)
  return id.slice(0, 12)
}

/** Group pending samples by scheduled calendar day (yyyy-MM-dd local). */
export function groupMuestrasByScheduledDay(muestras: MuestraWithRelations[]): Map<
  string,
  MuestraWithRelations[]
> {
  const map = new Map<string, MuestraWithRelations[]>()
  for (const m of muestras) {
    const d = getScheduledDateTime(m)
    if (!d) continue
    const key = format(d, 'yyyy-MM-dd')
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const da = getScheduledDateTime(a)?.getTime() ?? 0
      const db = getScheduledDateTime(b)?.getTime() ?? 0
      return da - db
    })
  }
  return map
}

export function specimenTypeLabel(tipo: string | undefined): string {
  if (tipo === 'CILINDRO') return 'Cilindro'
  if (tipo === 'VIGA') return 'Viga'
  if (tipo === 'CUBO') return 'Cubo'
  return tipo ?? '—'
}
