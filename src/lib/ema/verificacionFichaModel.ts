import type {
  CompletedVerificacionMeasurement,
  VerificacionTemplateItem,
  VerificacionTemplateSection,
} from '@/types/ema'
import { normalizeTemplateItem } from '@/lib/ema/templateItem'

export function buildMeasurementMap(
  measurements: CompletedVerificacionMeasurement[],
): Map<string, CompletedVerificacionMeasurement> {
  return new Map(measurements.map((m) => [`${m.section_id}:${m.section_repeticion}:${m.item_id}`, m]))
}

export function formatVerificacionMeasurement(
  item: VerificacionTemplateItem,
  m?: CompletedVerificacionMeasurement,
): string {
  if (!m) return '—'
  if (item.tipo === 'booleano') {
    if (m.valor_booleano === null) return '—'
    return m.valor_booleano ? 'Sí' : 'No'
  }
  if (item.tipo === 'texto' || item.tipo === 'referencia_equipo') {
    return m.valor_texto?.trim() || '—'
  }
  if (m.valor_observado != null) {
    return `${m.valor_observado}${item.unidad ? ` ${item.unidad}` : ''}`
  }
  return '—'
}

export function verificacionCumpleLabel(cumple: boolean | null | undefined): string {
  if (cumple === true) return 'Sí'
  if (cumple === false) return 'No'
  return '—'
}

export function verificacionRowCumple(
  sectionId: string,
  rep: number,
  items: VerificacionTemplateItem[],
  mMap: Map<string, CompletedVerificacionMeasurement>,
): boolean | null {
  const contributing = items.filter((it) => normalizeTemplateItem(it).contributes_to_cumple)
  if (!contributing.length) return null
  const values = contributing.map((it) => mMap.get(`${sectionId}:${rep}:${it.id}`)?.cumple)
  if (values.some((v) => v === false)) return false
  if (values.every((v) => v === true)) return true
  return null
}

export function sectionItemsForDisplay(
  section: VerificacionTemplateSection & { items?: VerificacionTemplateItem[] },
): VerificacionTemplateItem[] {
  return (section.items ?? []).filter((i) => normalizeTemplateItem(i).item_role !== 'derivado')
}

export function formatEsperadoItem(item: VerificacionTemplateItem): string {
  if (item.tipo === 'medicion' && item.valor_esperado != null) {
    let s = `${item.valor_esperado}${item.unidad ? ` ${item.unidad}` : ''}`
    if (item.tolerancia != null) s += ` ± ${item.tolerancia}`
    return s
  }
  if (item.tipo === 'booleano') return 'Sí / No'
  if (item.tipo === 'texto' || item.tipo === 'referencia_equipo') return 'Texto / referencia'
  return '—'
}

export function countMeasurementStats(measurements: CompletedVerificacionMeasurement[]): {
  total: number
  cumple: number
  noCumple: number
} {
  let cumple = 0
  let noCumple = 0
  let total = 0
  for (const m of measurements) {
    if (m.cumple === true) {
      cumple++
      total++
    } else if (m.cumple === false) {
      noCumple++
      total++
    }
  }
  return { total, cumple, noCumple }
}
