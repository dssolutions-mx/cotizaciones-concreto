import type { MuestreoWithRelations, MuestraWithRelations } from '@/types/quality'
import { formatYmdForDisplay } from '@/lib/parseLocalDate'
import {
  formatTipoMuestraLabel,
  formatEdadAlEnsayoShort,
  formatEdadGarantiaReceta,
  formatCalendarDateShort,
  resolveMuestreoCalendarYmd,
  resolveEnsayoCalendarYmd,
  resolveEnsayoResistenciaReportada,
  resolveEnsayoPorcentajeCumplimiento,
} from '@/lib/qualityHelpers'
function getConstructionSite(m: MuestreoWithRelations): string {
  const o = m.remision?.orders ?? m.remision?.order
  const site = o?.construction_site
  if (site && String(site).trim()) return String(site).trim()
  return 'Sin obra'
}

function internalAvgResistance(m: MuestreoWithRelations): number | null {
  const values: number[] = []
  for (const mu of m.muestras ?? []) {
    for (const e of mu.ensayos ?? []) {
      const r = resolveEnsayoResistenciaReportada(e)
      if (r > 0) values.push(r)
    }
  }
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function internalComplianceLabel(valorNum: number | null, fc: number | null | undefined): string {
  if (valorNum == null || fc == null || fc <= 0) return '—'
  if (valorNum >= fc) return 'Cumple'
  if (valorNum >= fc * 0.85) return 'Margen'
  return 'No cumple'
}

export type ExcelCellValue = string | number

/** Client-portal muestreo shape (processed in QualityMuestreos). */
export type ClientPortalMuestreoExport = Record<string, unknown> & {
  remisionNumber?: string
  numeroMuestreo?: number
  constructionSite?: string
  recipeCode?: string
  recipeFc?: number
  revenimientoSitio?: number
  masaUnitaria?: number
  volumenFabricado?: number
  temperaturaAmbiente?: number
  temperaturaConcreto?: number
  rendimientoVolumetrico?: number
  muestras?: Array<{
    id: string
    identificacion?: string
    tipoMuestra?: string
    tipo_muestra?: string
    ensayos?: Array<Record<string, unknown>>
  }>
  concrete_specs?: unknown
}

export function buildClientPortalMuestreosExcelRows(
  muestreos: ClientPortalMuestreoExport[]
): Record<string, ExcelCellValue>[] {
  const excelData: Record<string, ExcelCellValue>[] = []

  muestreos.forEach((muestreo) => {
    const muestras = muestreo.muestras ?? []
    const hasTests = muestras.some((m) => (m.ensayos?.length ?? 0) > 0)
    const allEnsayos = muestras.flatMap((m) => m.ensayos ?? [])
    const recipeFc = Number(muestreo.recipeFc) || 0

    const avgCompliance =
      hasTests && allEnsayos.length > 0
        ? allEnsayos.reduce(
            (sum, e) =>
              sum +
              Number(
                resolveEnsayoPorcentajeCumplimiento(e as Record<string, unknown>, recipeFc) || 0
              ),
            0
          ) / allEnsayos.length
        : null

    const avgResistance =
      hasTests && allEnsayos.length > 0
        ? allEnsayos.reduce(
            (sum, e) =>
              sum + Number(resolveEnsayoResistenciaReportada(e as Record<string, unknown>) || 0),
            0
          ) / allEnsayos.length
        : null

    const edadGarantiaReceta = formatEdadGarantiaReceta(muestreo.concrete_specs) || 'N/A'
    const muestreoAgeCtx = muestreo as Record<string, unknown>
    const ymd = resolveMuestreoCalendarYmd(muestreoAgeCtx)
    const fechaLabel = ymd ? (formatYmdForDisplay(ymd, 'dd/MM/yyyy') ?? 'N/A') : 'N/A'

    const baseRow: Record<string, ExcelCellValue> = {
      Remisión: muestreo.remisionNumber ?? 'N/A',
      'No. Muestreo': muestreo.numeroMuestreo ?? 'N/A',
      'Fecha Muestreo': fechaLabel,
      Obra: muestreo.constructionSite ?? 'N/A',
      'Código Receta': muestreo.recipeCode || 'N/A',
      "f'c Diseño (kg/cm²)": muestreo.recipeFc || 'N/A',
      'Edad garantía (receta)': edadGarantiaReceta,
      'Revenimiento (cm)': muestreo.revenimientoSitio ?? 'N/A',
      'Masa Unitaria (kg/m³)': muestreo.masaUnitaria ?? 'N/A',
      'Volumen Fabricado (m³)': muestreo.volumenFabricado
        ? Number(muestreo.volumenFabricado).toFixed(2)
        : 'N/A',
      'Temperatura Ambiente (°C)': muestreo.temperaturaAmbiente ?? 'N/A',
      'Temperatura Concreto (°C)': muestreo.temperaturaConcreto ?? 'N/A',
      'Rendimiento Volumétrico (%)': muestreo.rendimientoVolumetrico
        ? Number(muestreo.rendimientoVolumetrico).toFixed(1)
        : 'N/A',
      'Total Muestras': muestras.length,
      'Total Ensayos': allEnsayos.length,
      Tipo: hasTests ? 'Con Ensayos' : 'Site Check',
    }

    if (hasTests && allEnsayos.length > 0) {
      let ensayoIdx = 0
      muestras.forEach((muestra) => {
        const ident =
          (muestra.identificacion && String(muestra.identificacion).trim()) ||
          `Muestra ${String(muestra.id).slice(0, 8)}`
        const tipoLabel = formatTipoMuestraLabel(muestra.tipoMuestra ?? muestra.tipo_muestra)
        ;(muestra.ensayos ?? []).forEach((ensayo) => {
          ensayoIdx += 1
          const e = ensayo as Record<string, unknown>
          const res = resolveEnsayoResistenciaReportada(e)
          const comp = resolveEnsayoPorcentajeCumplimiento(e, recipeFc)
          excelData.push({
            ...baseRow,
            'No. Ensayo': ensayoIdx,
            'Identificación muestra': ident,
            'Tipo probeta': tipoLabel,
            'Edad al ensayo': formatEdadAlEnsayoShort(muestreoAgeCtx, e) || 'N/A',
                'Fecha ensayo': (() => {
                  const ey = resolveEnsayoCalendarYmd(e)
                  return ey ? (formatYmdForDisplay(ey, 'dd/MM/yyyy') ?? 'N/A') : 'N/A'
                })(),
            'Resistencia (kg/cm²)': Number(res || 0).toFixed(0),
            'Cumplimiento (%)': Number(comp || 0).toFixed(1),
            'Resistencia Promedio (kg/cm²)': avgResistance ? avgResistance.toFixed(0) : 'N/A',
            'Cumplimiento Promedio (%)': avgCompliance ? avgCompliance.toFixed(1) : 'N/A',
          })
        })
      })
    } else {
      excelData.push({
        ...baseRow,
        'No. Ensayo': 'N/A',
        'Identificación muestra': 'N/A',
        'Tipo probeta': 'N/A',
        'Edad al ensayo': 'N/A',
        'Fecha ensayo': 'N/A',
        'Resistencia (kg/cm²)': 'N/A',
        'Cumplimiento (%)': 'N/A',
        'Resistencia Promedio (kg/cm²)': 'N/A',
        'Cumplimiento Promedio (%)': 'N/A',
      })
    }
  })

  return excelData
}

function internalEstadoLabel(m: MuestreoWithRelations): string {
  if (!m.muestras?.length) return 'Sin muestras'
  if (m.muestras.every((mu) => mu.estado === 'ENSAYADO')) return 'Completado'
  if (
    m.muestras.some((mu) => mu.estado === 'ENSAYADO') &&
    m.muestras.some((mu) => mu.estado === 'PENDIENTE')
  ) {
    return 'En proceso'
  }
  if (m.muestras.every((mu) => mu.estado === 'PENDIENTE')) return 'Pendiente'
  return 'Mixto'
}

function recipeClasificacion(m: MuestreoWithRelations): string {
  const notes = m.remision?.recipe?.recipe_versions?.[0]?.notes ?? ''
  if (notes.includes('MR')) return 'MR'
  if (notes.includes('FC')) return 'FC'
  return notes ? String(notes).slice(0, 12) : '—'
}

export function buildInternalMuestreosExcelRows(
  muestreos: MuestreoWithRelations[]
): Record<string, ExcelCellValue>[] {
  const rows: Record<string, ExcelCellValue>[] = []

  for (const m of muestreos) {
    const clientName =
      m.remision?.orders?.clients?.business_name ||
      m.remision?.order?.clients?.business_name ||
      'N/A'
    const obra = getConstructionSite(m)
    const fc = m.remision?.recipe?.strength_fc ?? null
    const valorNum = internalAvgResistance(m)
    const muestreoCtx = m as unknown as Record<string, unknown>
    const ymdM = resolveMuestreoCalendarYmd(muestreoCtx)
    const fechaMuestreo = ymdM ? (formatYmdForDisplay(ymdM, 'dd/MM/yyyy') ?? '—') : '—'
    const edadGarantia = formatEdadGarantiaReceta(m.concrete_specs) ?? '—'
    const volumen = m.remision?.volumen_fabricado

    const base: Record<string, ExcelCellValue> = {
      Planta: m.planta ?? m.plant?.code ?? '—',
      'Fecha muestreo': fechaMuestreo,
      'Hora muestreo': m.hora_muestreo ?? '—',
      Remisión: m.remision?.remision_number ?? m.manual_reference ?? '—',
      Cliente: clientName,
      Obra: obra,
      'Código receta': m.remision?.recipe?.recipe_code ?? '—',
      "f'c (kg/cm²)": fc ?? '—',
      Clasificación: recipeClasificacion(m),
      'Edad garantía': edadGarantia,
      'No. muestreo': m.numero_muestreo,
      'Revenimiento (cm)': m.revenimiento_sitio ?? '—',
      'Masa unitaria (kg/m³)': m.masa_unitaria ?? '—',
      'Temp. ambiente (°C)': m.temperatura_ambiente ?? '—',
      'Temp. concreto (°C)': m.temperatura_concreto ?? '—',
      'Contenido aire (%)': m.contenido_aire ?? '—',
      'Volumen remisión (m³)': volumen != null ? Number(volumen).toFixed(2) : '—',
      'Rend. vol. (%)': '—',
      'Estado muestreo': internalEstadoLabel(m),
      'Resistencia prom. (kg/cm²)': valorNum ?? '—',
      'Cumplimiento resistencia': internalComplianceLabel(valorNum, fc),
      'Tipo registro': (m.muestras?.some((mu) => (mu.ensayos?.length ?? 0) > 0) ?? false)
        ? 'Con ensayos'
        : 'Sin ensayos',
    }

    const muestras = m.muestras ?? []
    if (muestras.length === 0) {
      rows.push({
        ...base,
        'Identificación muestra': '—',
        'Tipo probeta': '—',
        'Estado muestra': '—',
        'Fecha prog. ensayo': '—',
        'Fecha ensayo': '—',
        'Resistencia (kg/cm²)': '—',
        'Cumplimiento (%)': '—',
        'Edad al ensayo': '—',
        'Edad garantía ensayo': '—',
      })
      continue
    }

    muestras.forEach((muestra: MuestraWithRelations) => {
      const ident =
        (muestra.identificacion && String(muestra.identificacion).trim()) ||
        `Muestra ${String(muestra.id).slice(0, 8)}`
      const tipo = formatTipoMuestraLabel(muestra.tipo_muestra)
      const progFecha = formatCalendarDateShort(muestra.fecha_programada_ensayo) ?? '—'
      const ensayos = muestra.ensayos ?? []

      if (ensayos.length === 0) {
        rows.push({
          ...base,
          'Identificación muestra': ident,
          'Tipo probeta': tipo,
          'Estado muestra': muestra.estado,
          'Fecha prog. ensayo': progFecha,
          'Fecha ensayo': '—',
          'Resistencia (kg/cm²)': '—',
          'Cumplimiento (%)': '—',
          'Edad al ensayo': '—',
          'Edad garantía ensayo': muestra.is_edad_garantia ? 'Sí' : 'No',
        })
        return
      }

      ensayos.forEach((ensayo) => {
        const e = ensayo as unknown as Record<string, unknown>
        const res = resolveEnsayoResistenciaReportada(ensayo)
        const comp = resolveEnsayoPorcentajeCumplimiento(ensayo, Number(fc) || 0)
        rows.push({
          ...base,
          'Identificación muestra': ident,
          'Tipo probeta': tipo,
          'Estado muestra': muestra.estado,
          'Fecha prog. ensayo': progFecha,
          'Fecha ensayo': (() => {
            const ey = resolveEnsayoCalendarYmd(e)
            return ey ? (formatYmdForDisplay(ey, 'dd/MM/yyyy') ?? '—') : '—'
          })(),
          'Resistencia (kg/cm²)': res > 0 ? Math.round(res) : '—',
          'Cumplimiento (%)': comp > 0 ? Number(comp).toFixed(1) : '—',
          'Edad al ensayo': formatEdadAlEnsayoShort(muestreoCtx, e) ?? '—',
          'Edad garantía ensayo': muestra.is_edad_garantia ? 'Sí' : 'No',
        })
      })
    })
  }

  return rows
}
