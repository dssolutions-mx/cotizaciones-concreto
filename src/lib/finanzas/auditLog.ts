import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type FinanzasAuditInsert = {
  actor_id: string
  actor_role: string
  actor_plant_id: string | null
  entity_type: string
  entity_id: string
  order_id?: string | null
  quote_id?: string | null
  client_id?: string | null
  action: string
  reason: string
  changes: Array<{ field: string; old: unknown; new: unknown }>
  financial_delta?: Record<string, number | null> | null
  flags?: Record<string, boolean | string | null> | null
  source?: string
  request_ip?: string | null
  user_agent?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Campos seguros para el log (evita jsonb enorme o tipos raros al guardar filas completas). */
const ORDER_ITEM_AUDIT_FIELDS = [
  'id',
  'order_id',
  'quote_detail_id',
  'recipe_id',
  'master_recipe_id',
  'product_type',
  'volume',
  'unit_price',
  'total_price',
  'pump_price',
  'pump_volume',
  'billing_type',
  'has_pump_service',
] as const

export function pickOrderItemAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ORDER_ITEM_AUDIT_FIELDS) {
    if (k in row && row[k] !== undefined) out[k] = row[k]
  }
  return out
}

/** Postgres uuid columns reject empty strings and non-UUID text — normalize to null. */
export function toUuidOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  return UUID_RE.test(s) ? s : null
}

function assertUuid(column: string, value: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Auditoría: ${column} no es un UUID válido`)
  }
}

const SANITIZE_MAX_DEPTH = 24

/**
 * Values must be JSON-serializable for jsonb (no undefined, no NaN, no BigInt, etc.).
 * Depth-limited to avoid stack overflow on circular structures.
 */
export function sanitizeForJsonb(value: unknown, depth = 0): unknown {
  if (depth > SANITIZE_MAX_DEPTH) return '[…]'
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((x) => sanitizeForJsonb(x, depth + 1))
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o)) {
      out[k] = sanitizeForJsonb(o[k], depth + 1)
    }
    return out
  }
  return String(value)
}

function serializeUnknownErr(err: unknown): string {
  if (err instanceof Error) {
    return [err.message, err.stack].filter(Boolean).join('\n')
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function formatInsertError(err: unknown): string {
  const e =
    err && typeof err === 'object'
      ? (err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown })
      : null
  const message = typeof e?.message === 'string' ? e.message : ''
  const code = typeof e?.code === 'string' ? e.code : ''
  const details = typeof e?.details === 'string' ? e.details : ''
  const hint = typeof e?.hint === 'string' ? e.hint : ''
  const parts = [message, code && `(${code})`, details, hint].filter(Boolean) as string[]
  let msg = parts.join(' — ')
  if (msg) {
    if (/relation|does not exist|schema cache|42P01|PGRST205/i.test(msg)) {
      msg = `${msg} — ¿Aplicó la migración finanzas_audit_log en esta base? (supabase db push / SQL en supabase/migrations)`
    }
    return msg
  }
  return `No se pudo registrar la auditoría. Detalle técnico: ${serializeUnknownErr(err)}`
}

export async function insertFinanzasAuditLog(
  row: FinanzasAuditInsert,
  client: SupabaseClient = createAdminClient()
) {
  assertUuid('actor_id', row.actor_id)
  assertUuid('entity_id', row.entity_id)

  const safeChanges = row.changes.map((c) => ({
    field: c.field,
    old: sanitizeForJsonb(c.old),
    new: sanitizeForJsonb(c.new),
  }))

  const payload = {
    actor_id: row.actor_id,
    actor_role: row.actor_role,
    actor_plant_id: toUuidOrNull(row.actor_plant_id),
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    order_id: toUuidOrNull(row.order_id),
    quote_id: toUuidOrNull(row.quote_id),
    client_id: toUuidOrNull(row.client_id),
    action: row.action,
    reason: row.reason,
    changes: safeChanges,
    financial_delta: sanitizeForJsonb(row.financial_delta ?? null),
    flags: sanitizeForJsonb(row.flags ?? null),
    source: row.source ?? 'evidencia-remisiones-concreto',
    request_ip: row.request_ip ?? null,
    user_agent: row.user_agent ?? null,
  }

  const { error } = await client.from('finanzas_audit_log').insert(payload)

  if (error) {
    console.error('[finanzas_audit_log] insert failed', error)
    throw new Error(formatInsertError(error))
  }
}
