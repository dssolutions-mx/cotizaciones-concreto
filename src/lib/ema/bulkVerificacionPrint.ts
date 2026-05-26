'use client'

import { EMA_BULK_VERIFICACION_PRINT_MAX } from '@/lib/ema/emaBulkVerificacionLimits'

export { EMA_BULK_VERIFICACION_PRINT_MAX }

const SESSION_KEY = 'ema.bulkVerificacionPrint'

export type BulkVerificacionPrintSession = {
  ids: string[]
  backHref: string
}

export function readBulkVerificacionPrintSession(): BulkVerificacionPrintSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BulkVerificacionPrintSession
    if (!Array.isArray(parsed.ids) || parsed.ids.length === 0 || typeof parsed.backHref !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearBulkVerificacionPrintSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}

export type StartBulkVerificacionPrintResult =
  | { ok: true }
  | { ok: false; error: string }

/** Persist selection and navigate to the bulk print page. Caller supplies router.push. */
export function prepareBulkVerificacionPrint(
  ids: string[],
  backHref: string,
): StartBulkVerificacionPrintResult {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return { ok: false, error: 'Seleccione al menos una verificación.' }
  }
  if (unique.length > EMA_BULK_VERIFICACION_PRINT_MAX) {
    return {
      ok: false,
      error: `Máximo ${EMA_BULK_VERIFICACION_PRINT_MAX} verificaciones por informe.`,
    }
  }
  if (typeof window === 'undefined') {
    return { ok: false, error: 'No disponible en el servidor.' }
  }
  const payload: BulkVerificacionPrintSession = { ids: unique, backHref }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  return { ok: true }
}
