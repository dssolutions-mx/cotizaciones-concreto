import { createSafeDate } from '@/lib/utils'
import type { Ensayo, MuestraWithRelations, MuestreoWithRelations } from '@/types/quality'

export function getOrderInfo(muestreo: MuestreoWithRelations) {
  if (!muestreo.remision?.order?.id) return null
  return muestreo.remision.order
}

export function getDateForSort(m: MuestraWithRelations): Date {
  const ts = (m as { fecha_programada_ensayo_ts?: string }).fecha_programada_ensayo_ts
  const byTs = ts ? createSafeDate(ts) : null
  if (byTs) return byTs
  const byDate = m.fecha_programada_ensayo ? createSafeDate(m.fecha_programada_ensayo) : null
  if (byDate) return byDate
  const ensayo = m.ensayos?.[0] as Ensayo | undefined
  const realTs = ensayo?.fecha_ensayo_ts ? createSafeDate(ensayo.fecha_ensayo_ts) : null
  if (realTs) return realTs
  const real = ensayo?.fecha_ensayo ? createSafeDate(ensayo.fecha_ensayo) : null
  if (real) return real
  return createSafeDate((m as { created_at?: string }).created_at) || new Date(0)
}

function prefixFor(m: MuestraWithRelations) {
  const tipo = m.tipo_muestra
  if (tipo === 'CUBO') {
    const side = (m as { cube_side_cm?: number }).cube_side_cm ?? 15
    return `CUBO-${String(side)}X${String(side)}`
  }
  if (tipo === 'CILINDRO') {
    const dia = (m as { diameter_cm?: number }).diameter_cm ?? 15
    return `CILINDRO-${String(dia)}`
  }
  return 'VIGA'
}

export function buildOrderedMuestrasWithDisplayNames(muestreo: MuestreoWithRelations) {
  const muestrasOrdenadas = [...(muestreo.muestras || [])].sort((a, b) => {
    const ad = getDateForSort(a).getTime()
    const bd = getDateForSort(b).getTime()
    if (ad !== bd) return ad - bd
    const ai = (a.identificacion || '').localeCompare(b.identificacion || '')
    if (ai !== 0) return ai
    return ((a as { created_at?: string }).created_at || '').localeCompare(
      (b as { created_at?: string }).created_at || ''
    )
  })

  const counters: Record<string, number> = {}
  const displayNameById = new Map<string, string>()
  muestrasOrdenadas.forEach((m) => {
    const pref = prefixFor(m)
    counters[pref] = (counters[pref] || 0) + 1
    displayNameById.set(m.id, `${pref}-${counters[pref]}`)
  })

  return { muestrasOrdenadas, displayNameById }
}

export function getFirstEnsayoId(muestreo: MuestreoWithRelations): string | undefined {
  const all = muestreo.muestras?.flatMap((m) => m.ensayos || []) || []
  if (all.length === 0) return undefined
  const sorted = [...all].sort((a, b) => {
    const at = (a as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || a.fecha_ensayo || ''
    const bt = (b as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || b.fecha_ensayo || ''
    return new Date(at).getTime() - new Date(bt).getTime()
  })
  return sorted[0]?.id
}

export function getMuestreoPageStatus(muestreo: MuestreoWithRelations): {
  label: string
  className: string
} {
  const muestras = muestreo.muestras || []
  if (muestras.length === 0) {
    return { label: 'Sin muestras', className: 'bg-stone-100 text-stone-700 border-stone-300' }
  }
  const allTested = muestras.every((m) => m.estado === 'ENSAYADO')
  if (allTested) {
    return { label: 'Completado', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
  }
  const anyPending = muestras.some((m) => m.estado === 'PENDIENTE')
  if (anyPending) {
    return { label: 'En progreso', className: 'bg-amber-50 text-amber-900 border-amber-300' }
  }
  return { label: 'En revisión', className: 'bg-stone-50 text-stone-800 border-stone-300' }
}

