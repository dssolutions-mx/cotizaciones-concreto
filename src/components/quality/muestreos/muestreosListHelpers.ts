import type { MuestreoWithRelations, MuestraWithRelations, Ensayo } from '@/types/quality'
import { resolveEnsayoResistenciaReportada, calendarDateToChartMs } from '@/lib/qualityHelpers'
import { parseLocalDate } from '@/lib/parseLocalDate'

export function getConstructionSite(muestreo: MuestreoWithRelations): string {
  const o = muestreo.remision?.orders ?? muestreo.remision?.order
  const site = o?.construction_site
  if (site && String(site).trim()) return String(site).trim()
  return 'Sin obra'
}

export function calcularResistencia(muestreo: MuestreoWithRelations): {
  valorNum: number | null
  edadDias: number | null
} {
  const muestras = muestreo.muestras
  if (!muestras || muestras.length === 0) return { valorNum: null, edadDias: null }

  const fechaMuestreo = calendarDateToChartMs(muestreo.fecha_muestreo)

  const calcEdad = (m: MuestraWithRelations): number | null => {
    if (fechaMuestreo == null) return null
    const progDay = String(m.fecha_programada_ensayo).split('T')[0]
    const progMs = /^\d{4}-\d{2}-\d{2}$/.test(progDay)
      ? parseLocalDate(progDay).getTime()
      : new Date(m.fecha_programada_ensayo).getTime()
    const diff = progMs - fechaMuestreo
    return Math.round(diff / (1000 * 60 * 60 * 24))
  }

  const muestrasEnsayadas = muestras.filter(
    (m) => m.estado === 'ENSAYADO' && m.ensayos && m.ensayos.length > 0
  )
  if (muestrasEnsayadas.length === 0) return { valorNum: null, edadDias: null }

  const garantiaEnsayadas = muestrasEnsayadas.filter((m) => m.is_edad_garantia === true)

  if (garantiaEnsayadas.length > 0) {
    const resistencias = garantiaEnsayadas.flatMap((m) =>
      (m.ensayos || [])
        .map((e) => resolveEnsayoResistenciaReportada(e as Ensayo))
        .filter((v) => v > 0)
    )
    if (resistencias.length === 0) return { valorNum: null, edadDias: null }
    const promedio = resistencias.reduce((a, b) => a + b, 0) / resistencias.length
    const edad = calcEdad(garantiaEnsayadas[0])
    return { valorNum: Math.round(promedio), edadDias: edad }
  }

  const fechasSorted = [...muestrasEnsayadas].sort(
    (a, b) =>
      new Date(b.fecha_programada_ensayo).getTime() - new Date(a.fecha_programada_ensayo).getTime()
  )
  const fechaMasReciente = fechasSorted[0].fecha_programada_ensayo
  const muestrasEdadReciente = fechasSorted.filter((m) => m.fecha_programada_ensayo === fechaMasReciente)
  const resistencias = muestrasEdadReciente.flatMap((m) =>
    (m.ensayos || [])
      .map((e) => resolveEnsayoResistenciaReportada(e as Ensayo))
      .filter((v) => v > 0)
  )
  if (resistencias.length === 0) return { valorNum: null, edadDias: null }
  const promedio = resistencias.reduce((a, b) => a + b, 0) / resistencias.length
  const edad = calcEdad(muestrasEdadReciente[0])
  return { valorNum: Math.round(promedio), edadDias: edad }
}

export type ResistanceCompliance = 'none' | 'pass' | 'warn' | 'fail'

export function resistanceComplianceClass(c: ResistanceCompliance): string {
  switch (c) {
    case 'pass':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
    case 'warn':
      return 'bg-amber-50 text-amber-800 border border-amber-200'
    case 'fail':
      return 'bg-red-50 text-red-800 border border-red-200'
    default:
      return 'text-stone-400'
  }
}

export function computeResistanceCompliance(
  valorNum: number | null,
  fc: number | null | undefined
): ResistanceCompliance {
  if (valorNum == null || fc == null || fc <= 0) return 'none'
  if (valorNum >= fc) return 'pass'
  if (valorNum >= fc * 0.85) return 'warn'
  return 'fail'
}

/** One dot per muestra: tested | nextPending | pending | discarded | not_done */
export type SpecimenDotKind = 'tested' | 'next' | 'pending' | 'discarded' | 'not_done'

export function computeSpecimenDots(muestreo: MuestreoWithRelations): {
  dots: SpecimenDotKind[]
  /** ISO date string of nearest pending ensayo, for display */
  nextPendingFecha: string | null
} {
  const muestras = muestreo.muestras
  if (!muestras || muestras.length === 0) return { dots: [], nextPendingFecha: null }

  const sorted = [...muestras].sort(
    (a, b) =>
      new Date(a.fecha_programada_ensayo).getTime() - new Date(b.fecha_programada_ensayo).getTime()
  )

  const pendientes = sorted.filter((m) => m.estado === 'PENDIENTE')
  const nextPending = pendientes[0] ?? null
  const nextFecha = nextPending?.fecha_programada_ensayo ?? null

  const dots: SpecimenDotKind[] = sorted.map((m) => {
    if (m.estado === 'DESCARTADO') return 'discarded'
    if (m.estado === 'NO_REALIZADO') return 'not_done'
    if (m.estado === 'ENSAYADO') return 'tested'
    if (nextPending && m.id === nextPending.id) return 'next'
    return 'pending'
  })

  return { dots, nextPendingFecha: nextFecha }
}

export function computeMuestreoKpis(muestreos: MuestreoWithRelations[]) {
  const total = muestreos.length

  const pendientesEnsayo = muestreos.filter((m) =>
    (m.muestras || []).some((mu) => mu.estado === 'PENDIENTE')
  ).length

  let sumRes = 0
  let countRes = 0
  let passCount = 0
  let passDenom = 0

  for (const m of muestreos) {
    const { valorNum } = calcularResistencia(m)
    const fc = m.remision?.recipe?.strength_fc
    if (valorNum != null) {
      sumRes += valorNum
      countRes++
    }
    if (valorNum != null && fc != null && fc > 0) {
      passDenom++
      if (valorNum >= fc) passCount++
    }
  }

  const tasaCumplimiento =
    passDenom > 0 ? Math.round((passCount / passDenom) * 1000) / 10 : null

  const resistenciaPromedio = countRes > 0 ? Math.round(sumRes / countRes) : null

  return {
    total,
    pendientesEnsayo,
    tasaCumplimiento,
    resistenciaPromedio,
  }
}

export type SortOption =
  | 'fecha_desc'
  | 'fecha_asc'
  | 'remision_desc'
  | 'remision_asc'
  | 'f_c_desc'
  | 'f_c_asc'

export interface MuestreosListFilterParams {
  searchQuery: string
  clasificacion: string
  estadoMuestreo: string
  sortOption: SortOption
}

export function filterAndSortMuestreosList(
  muestreos: MuestreoWithRelations[],
  params: MuestreosListFilterParams
): MuestreoWithRelations[] {
  let filtered = [...muestreos]
  const { searchQuery, clasificacion, estadoMuestreo, sortOption } = params
  const { sortBy, sortDirection } = parseSortOption(sortOption)

  if (searchQuery) {
    const search = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (m) =>
        m.remision?.remision_number?.toString().toLowerCase().includes(search) ||
        m.remision?.orders?.clients?.business_name?.toLowerCase().includes(search) ||
        m.remision?.order?.clients?.business_name?.toLowerCase().includes(search) ||
        m.remision?.recipe?.recipe_code?.toLowerCase().includes(search) ||
        getConstructionSite(m).toLowerCase().includes(search) ||
        m.manual_reference?.toLowerCase().includes(search)
    )
  }

  if (clasificacion && clasificacion !== 'todas') {
    filtered = filtered.filter((m) => {
      const recipeNotes = m.remision?.recipe?.recipe_versions?.[0]?.notes || ''
      return recipeNotes.includes(clasificacion)
    })
  }

  if (estadoMuestreo && estadoMuestreo !== 'todos') {
    filtered = filtered.filter((m) => {
      if (!m.muestras || m.muestras.length === 0) return false
      switch (estadoMuestreo) {
        case 'completado':
          return (
            m.muestras.every(
              (muestra) =>
                muestra.estado === 'ENSAYADO' ||
                muestra.estado === 'NO_REALIZADO' ||
                muestra.estado === 'DESCARTADO'
            ) && m.muestras.some((muestra) => muestra.estado === 'ENSAYADO')
          )
        case 'en-proceso':
          return (
            m.muestras.some((muestra) => muestra.estado === 'ENSAYADO') &&
            m.muestras.some((muestra) => muestra.estado === 'PENDIENTE')
          )
        case 'pendiente':
          return m.muestras.every((muestra) => muestra.estado === 'PENDIENTE')
        default:
          return true
      }
    })
  }

  filtered.sort((a, b) => {
    let valA: number
    let valB: number
    switch (sortBy) {
      case 'fecha':
        valA = calendarDateToChartMs(a.fecha_muestreo) ?? 0
        valB = calendarDateToChartMs(b.fecha_muestreo) ?? 0
        break
      case 'remision':
        valA = Number(a.remision?.remision_number) || 0
        valB = Number(b.remision?.remision_number) || 0
        break
      case 'f_c':
        valA = a.remision?.recipe?.strength_fc || 0
        valB = b.remision?.recipe?.strength_fc || 0
        break
      default:
        valA = calendarDateToChartMs(a.fecha_muestreo) ?? 0
        valB = calendarDateToChartMs(b.fecha_muestreo) ?? 0
    }
    return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1
  })

  return filtered
}

export function parseSortOption(option: SortOption): { sortBy: string; sortDirection: 'asc' | 'desc' } {
  const map: Record<SortOption, { sortBy: string; sortDirection: 'asc' | 'desc' }> = {
    fecha_desc: { sortBy: 'fecha', sortDirection: 'desc' },
    fecha_asc: { sortBy: 'fecha', sortDirection: 'asc' },
    remision_desc: { sortBy: 'remision', sortDirection: 'desc' },
    remision_asc: { sortBy: 'remision', sortDirection: 'asc' },
    f_c_desc: { sortBy: 'f_c', sortDirection: 'desc' },
    f_c_asc: { sortBy: 'f_c', sortDirection: 'asc' },
  }
  return map[option] ?? { sortBy: 'fecha', sortDirection: 'desc' }
}
