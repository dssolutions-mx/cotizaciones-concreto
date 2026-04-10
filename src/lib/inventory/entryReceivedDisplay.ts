import { format, parse, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MaterialEntry } from '@/types/inventory'

/** Normalize time for ISO parsing (accepts HH:mm or HH:mm:ss from DB). */
export function normalizeEntryTimeForIso(entryTime: string | null | undefined): string {
  const t = (entryTime || '12:00:00').trim()
  if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}

/**
 * Combined `entry_date` + `entry_time` as a single Date.
 * Note: `entry_time` is set server-side when the row is saved (see POST inventory/entries),
 * so it reflects **registro/guardado**, not an independently chosen “hora de recepción” in planta.
 */
export function parseEntryDateTime(entry: Pick<MaterialEntry, 'entry_date' | 'entry_time'>): Date {
  const d = entry.entry_date || ''
  const t = normalizeEntryTimeForIso(entry.entry_time)
  return new Date(`${d}T${t}`)
}

/** Calendar day the user assigned to the reception (`entry_date` only). */
export function formatReceptionAssignedDay(
  entry: Pick<MaterialEntry, 'entry_date'>,
  pattern = 'dd MMM yyyy'
): string {
  const d = entry.entry_date?.trim()
  if (!d) return '—'
  try {
    const dt = parse(d, 'yyyy-MM-dd', new Date())
    if (Number.isNaN(dt.getTime())) return '—'
    return format(dt, pattern, { locale: es })
  } catch {
    return '—'
  }
}

/** When the entry row was saved (DB `created_at`). */
export function formatEntrySavedAt(
  entry: Pick<MaterialEntry, 'created_at'>,
  pattern = 'dd MMM yyyy HH:mm'
): string {
  const raw = entry.created_at
  if (!raw) return '—'
  try {
    const dt = parseISO(raw)
    if (Number.isNaN(dt.getTime())) return '—'
    return format(dt, pattern, { locale: es })
  } catch {
    return '—'
  }
}

/**
 * Short label for “registro guardado”: time only if same calendar day as `entry_date`,
 * otherwise full date-time (late capture for a prior day).
 */
export function formatEntrySavedShortFor(entry: Pick<MaterialEntry, 'entry_date' | 'created_at'>): string {
  const day = entry.entry_date?.trim()
  if (!entry.created_at) return '—'
  try {
    const dt = parseISO(entry.created_at)
    if (Number.isNaN(dt.getTime())) return '—'
    const savedDay = format(dt, 'yyyy-MM-dd')
    if (day && day === savedDay) return format(dt, 'HH:mm', { locale: es })
    return format(dt, 'dd MMM yyyy HH:mm', { locale: es })
  } catch {
    return '—'
  }
}

export type ReceivedQuantityDisplay = {
  /** Numeric value shown to the user */
  value: number
  /** Unit label: kg, m³, or L */
  unit: 'kg' | 'm³' | 'L'
}

/**
 * Receipt quantity for UI: uses entry capture fields, not material.unit_of_measure
 * (which is often recipe-style e.g. kg/m³).
 */
export function getReceivedQuantityDisplay(entry: MaterialEntry): ReceivedQuantityDisplay {
  const uom = entry.received_uom
  if (uom === 'm3') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    return { value: n, unit: 'm³' }
  }
  if (uom === 'l') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    return { value: n, unit: 'L' }
  }
  const n = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
  return { value: n, unit: 'kg' }
}

const MX = 'es-MX'

export function formatReceivedQuantity(entry: MaterialEntry, opts?: { maximumFractionDigits?: number }): string {
  const { value, unit } = getReceivedQuantityDisplay(entry)
  const max = opts?.maximumFractionDigits ?? (unit === 'kg' ? 0 : 2)
  const s = value.toLocaleString(MX, { minimumFractionDigits: 0, maximumFractionDigits: max })
  return `${s} ${unit}`
}
