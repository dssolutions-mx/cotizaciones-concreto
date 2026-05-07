import ExcelJS from 'exceljs'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Types (matching /api/quality/materials/[id]/trend response) ──────────────

interface StatEntry {
  mean: number | null
  stdDev: number | null
  cv: number | null
  count: number
  min: number | null
  max: number | null
}

interface PropertyReading {
  id: string
  reading_date: string
  source: string
  tecnico?: string | null
  lote?: string | null
  [key: string]: unknown
}

interface GranulometryEvent {
  alta_estudio: { fecha_muestreo?: string | null; fecha_elaboracion?: string | null } | null
  mallas: { abertura_mm: number; numero_malla: string; porcentaje_pasa: number }[]
  modulo_finura?: number | null
}

interface TrendData {
  material: {
    material_name: string
    category: string
    suppliers?: { name: string } | null
    plants?: { name: string } | null
  }
  propertyTimeline: PropertyReading[]
  granulometryHistory: GranulometryEvent[]
  stats: Record<string, StatEntry>
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PROPERTY_LABELS: Record<string, { label: string; unit: string }> = {
  resistencia_compresion:      { label: 'Resistencia a la compresión', unit: 'kg/cm²' },
  tiempo_fraguado_inicial:     { label: 'Tiempo de fraguado inicial',  unit: 'min' },
  tiempo_fraguado_final:       { label: 'Tiempo de fraguado final',    unit: 'min' },
  ph:                          { label: 'pH',                          unit: '' },
  densidad_aditivo:            { label: 'Densidad',                    unit: 'g/cm³' },
  peso_volumetrico_suelto:     { label: 'Peso volumétrico suelto',     unit: 'kg/m³' },
  peso_volumetrico_compactado: { label: 'Peso volumétrico compactado', unit: 'kg/m³' },
  densidad_agregado:           { label: 'Densidad (masa específica)',  unit: 'g/cm³' },
  absorcion:                   { label: 'Absorción',                   unit: '%' },
  modulo_finura:               { label: 'Módulo de finura',            unit: '' },
  perdida_lavado:              { label: 'Pérdida por lavado',          unit: '%' },
}

const PROPERTIES_BY_CATEGORY: Record<string, string[]> = {
  cemento:  ['resistencia_compresion', 'tiempo_fraguado_inicial', 'tiempo_fraguado_final'],
  aditivo:  ['ph', 'densidad_aditivo'],
  arena:    ['absorcion', 'modulo_finura', 'perdida_lavado', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado', 'densidad_agregado'],
  grava:    ['absorcion', 'densidad_agregado', 'modulo_finura', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado'],
  agregado: ['absorcion', 'modulo_finura', 'densidad_agregado', 'peso_volumetrico_suelto', 'peso_volumetrico_compactado', 'perdida_lavado'],
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLORS = {
  navy:       'FF1E3A5F',
  sky:        'FF0284C7',
  emerald:    'FF10B981',
  amber:      'FFFBBF24',
  red:        'FFDC2626',
  redLight:   'FFFEE2E2',
  white:      'FFFFFFFF',
  stone100:   'FFF5F5F4',
  stone200:   'FFE7E5E4',
  stone500:   'FF78716C',
  stone700:   'FF44403C',
  stone900:   'FF1C1917',
}

function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: COLORS.white }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: { bottom: { style: 'medium', color: { argb: COLORS.sky } } },
  }
}

function subHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: COLORS.stone700 }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.stone100 } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  }
}

function dataStyle(zebra = false): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, color: { argb: COLORS.stone900 }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra ? COLORS.stone100 : COLORS.white } },
    alignment: { vertical: 'middle', horizontal: 'right' },
  }
}

function oocStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: COLORS.red }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.redLight } },
    alignment: { vertical: 'middle', horizontal: 'right' },
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function exportMaterialTrendExcel(data: TrendData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DS Solutions — Quality Hub'
  wb.created = new Date()

  const { material, propertyTimeline, granulometryHistory, stats } = data
  const properties = PROPERTIES_BY_CATEGORY[material.category] ?? PROPERTIES_BY_CATEGORY.agregado
  const isAgregado = !['cemento', 'aditivo'].includes(material.category)

  // ── Sheet 1: Control Estadístico ──────────────────────────────────────────

  const ws1 = wb.addWorksheet('Control Estadístico', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  })

  // Title row
  ws1.mergeCells('A1', String.fromCharCode(65 + 1 + properties.length * 4) + '1')
  const titleCell = ws1.getCell('A1')
  titleCell.value = `Control Estadístico — ${material.material_name}`
  titleCell.style = {
    font: { bold: true, size: 13, color: { argb: COLORS.white }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  }
  ws1.getRow(1).height = 24

  // Metadata row
  ws1.getRow(2).height = 16
  const meta = [
    material.suppliers?.name && `Proveedor: ${material.suppliers.name}`,
    material.plants?.name && `Planta: ${material.plants.name}`,
    `Generado: ${format(new Date(), "d MMM yyyy HH:mm", { locale: es })}`,
  ].filter(Boolean).join('  |  ')
  ws1.mergeCells('A2', String.fromCharCode(65 + 1 + properties.length * 4) + '2')
  const metaCell = ws1.getCell('A2')
  metaCell.value = meta
  metaCell.style = {
    font: { italic: true, size: 8, color: { argb: COLORS.stone500 }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.stone100 } },
  }

  // Column headers row 3
  const hdrs: Array<{ header: string; key: string; width: number }> = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Fuente', key: 'fuente', width: 14 },
    { header: 'Técnico', key: 'tecnico', width: 14 },
    { header: 'Lote', key: 'lote', width: 12 },
  ]
  for (const prop of properties) {
    const cfg = PROPERTY_LABELS[prop]
    hdrs.push({ header: `${cfg?.label ?? prop}${cfg?.unit ? ` (${cfg.unit})` : ''}`, key: prop, width: 16 })
    hdrs.push({ header: 'UCL', key: `${prop}_ucl`, width: 10 })
    hdrs.push({ header: 'Media (μ)', key: `${prop}_mean`, width: 10 })
    hdrs.push({ header: 'LCL', key: `${prop}_lcl`, width: 10 })
  }

  ws1.columns = hdrs.map((h, i) => ({
    key: h.key,
    width: h.width,
    header: '',
  }))

  const hdrRow = ws1.getRow(3)
  hdrs.forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1)
    cell.value = h.header
    cell.style = headerStyle()
  })
  hdrRow.height = 32

  // Data rows
  propertyTimeline.forEach((r, rowIdx) => {
    const row = ws1.addRow({})
    const zebra = rowIdx % 2 === 1
    const dateStr = format(parseISO(r.reading_date), 'd MMM yyyy', { locale: es })

    const baseData: Record<string, string | number> = {
      fecha: dateStr,
      fuente: r.source === 'manual' ? 'Manual' : 'Caracterización',
      tecnico: r.tecnico ?? '',
      lote: r.lote ?? '',
    }

    let colIdx = 1
    // Date / meta columns
    for (const key of ['fecha', 'fuente', 'tecnico', 'lote']) {
      const cell = row.getCell(colIdx++)
      cell.value = baseData[key]
      cell.style = { ...dataStyle(zebra), alignment: { vertical: 'middle', horizontal: 'left' } }
    }

    // Property columns + control limits
    for (const prop of properties) {
      const val = r[prop] as number | null | undefined
      const stat = stats[prop]
      const ucl = stat?.mean != null && stat?.stdDev != null ? stat.mean + 3 * stat.stdDev : null
      const lcl = stat?.mean != null && stat?.stdDev != null ? stat.mean - 3 * stat.stdDev : null
      const isOoc = val != null && ((ucl != null && val > ucl) || (lcl != null && lcl > 0 && val < lcl))

      // Value
      const valCell = row.getCell(colIdx++)
      valCell.value = val ?? null
      valCell.numFmt = '0.000'
      valCell.style = isOoc ? oocStyle() : dataStyle(zebra)

      // UCL
      const uclCell = row.getCell(colIdx++)
      uclCell.value = ucl != null ? Math.round(ucl * 1000) / 1000 : null
      uclCell.numFmt = '0.000'
      uclCell.style = { ...dataStyle(zebra), font: { size: 8, color: { argb: COLORS.stone500 }, italic: true, name: 'Calibri' } }

      // Mean
      const meanCell = row.getCell(colIdx++)
      meanCell.value = stat?.mean != null ? Math.round(stat.mean * 1000) / 1000 : null
      meanCell.numFmt = '0.000'
      meanCell.style = { ...dataStyle(zebra), font: { size: 8, color: { argb: COLORS.emerald.replace('FF', '') === COLORS.emerald ? COLORS.emerald : COLORS.emerald }, italic: true, name: 'Calibri' } }

      // LCL
      const lclCell = row.getCell(colIdx++)
      lclCell.value = lcl != null && lcl > 0 ? Math.round(lcl * 1000) / 1000 : null
      lclCell.numFmt = '0.000'
      lclCell.style = { ...dataStyle(zebra), font: { size: 8, color: { argb: COLORS.stone500 }, italic: true, name: 'Calibri' } }
    }

    row.height = 16
  })

  ws1.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + propertyTimeline.length, column: hdrs.length },
  }

  // ── Sheet 2: Estadísticas ─────────────────────────────────────────────────

  const ws2 = wb.addWorksheet('Estadísticas')
  ws2.columns = [
    { key: 'propiedad', width: 32 },
    { key: 'unidad',    width: 10 },
    { key: 'n',         width: 8 },
    { key: 'mean',      width: 12 },
    { key: 'std',       width: 12 },
    { key: 'cv',        width: 10 },
    { key: 'min',       width: 12 },
    { key: 'max',       width: 12 },
    { key: 'ucl',       width: 12 },
    { key: 'lcl',       width: 12 },
  ]

  // Title
  ws2.mergeCells('A1:J1')
  const t2 = ws2.getCell('A1')
  t2.value = `Estadísticas de control — ${material.material_name}`
  t2.style = {
    font: { bold: true, size: 13, color: { argb: COLORS.white }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } },
  }
  ws2.getRow(1).height = 22

  // Headers
  const statsHdr = ['Propiedad', 'Unidad', 'n', 'Media (μ)', 'Desv. estándar (σ)', 'CV (%)', 'Mínimo', 'Máximo', 'UCL (μ+3σ)', 'LCL (μ−3σ)']
  const hdr2 = ws2.addRow(statsHdr)
  hdr2.eachCell((cell) => { cell.style = headerStyle() })
  hdr2.height = 20

  properties.forEach((prop, i) => {
    const cfg = PROPERTY_LABELS[prop]
    const stat = stats[prop]
    const ucl = stat?.mean != null && stat?.stdDev != null ? stat.mean + 3 * stat.stdDev : null
    const lcl = stat?.mean != null && stat?.stdDev != null ? stat.mean - 3 * stat.stdDev : null

    const row = ws2.addRow([
      cfg?.label ?? prop,
      cfg?.unit ?? '',
      stat?.count ?? 0,
      stat?.mean != null ? Math.round(stat.mean * 10000) / 10000 : '—',
      stat?.stdDev != null ? Math.round(stat.stdDev * 10000) / 10000 : '—',
      stat?.cv != null ? Math.round(stat.cv * 100) / 100 : '—',
      stat?.min != null ? Math.round(stat.min * 10000) / 10000 : '—',
      stat?.max != null ? Math.round(stat.max * 10000) / 10000 : '—',
      ucl != null ? Math.round(ucl * 10000) / 10000 : '—',
      lcl != null && lcl > 0 ? Math.round(lcl * 10000) / 10000 : '—',
    ])
    row.eachCell((cell, colNum) => {
      cell.style = colNum > 2 ? { ...dataStyle(i % 2 === 1), alignment: { horizontal: 'right', vertical: 'middle' } }
        : { ...dataStyle(i % 2 === 1), alignment: { horizontal: 'left', vertical: 'middle' } }
    })
    row.height = 16
  })

  // ── Sheet 3: Granulometría (agregados only) ───────────────────────────────

  if (isAgregado && granulometryHistory.length > 0) {
    const ws3 = wb.addWorksheet('Granulometría')

    // Collect all unique sieve sizes
    const allSieves = new Set<number>()
    granulometryHistory.forEach((ev) => {
      ev.mallas.forEach((m) => { if (m.abertura_mm > 0) allSieves.add(m.abertura_mm) })
    })
    const SIEVE_ORDER = [75, 50, 37.5, 25, 19, 12.5, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15, 0.075]
    const sieves = SIEVE_ORDER.filter((s) => allSieves.has(s))

    // Headers: Malla | mm | Study1 | Study2 ...
    const studyLabels = granulometryHistory.map((ev, i) => {
      const date = ev.alta_estudio?.fecha_muestreo ?? ev.alta_estudio?.fecha_elaboracion
      return date ? format(parseISO(date), 'd MMM yyyy', { locale: es }) : `Estudio ${i + 1}`
    })

    ws3.columns = [
      { key: 'malla', width: 12 },
      { key: 'mm', width: 10 },
      ...studyLabels.map((l, i) => ({ key: `s${i}`, width: 14 })),
    ]

    // Title
    ws3.mergeCells(1, 1, 1, 2 + studyLabels.length)
    const t3 = ws3.getCell('A1')
    t3.value = `Granulometría histórica — ${material.material_name}`
    t3.style = {
      font: { bold: true, size: 13, color: { argb: COLORS.white }, name: 'Calibri' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } },
    }
    ws3.getRow(1).height = 22

    // Column headers
    const granHdr = ws3.addRow(['Malla', 'Abertura (mm)', ...studyLabels])
    granHdr.eachCell((cell) => { cell.style = headerStyle() })
    granHdr.height = 20

    // Data rows
    sieves.forEach((mm, i) => {
      const label = mm >= 4.75 ? `${mm}mm`
        : mm === 2.36 ? 'No.8' : mm === 1.18 ? 'No.16' : mm === 0.6 ? 'No.30'
        : mm === 0.3 ? 'No.50' : mm === 0.15 ? 'No.100' : mm === 0.075 ? 'No.200' : `${mm}`
      const zebra = i % 2 === 1
      const row = ws3.addRow([
        label,
        mm,
        ...granulometryHistory.map((ev) => {
          const malla = ev.mallas.find((m) => Math.abs(m.abertura_mm - mm) < 0.01)
          return malla?.porcentaje_pasa ?? null
        }),
      ])
      row.eachCell((cell, colNum) => {
        cell.style = {
          ...dataStyle(zebra),
          numFmt: colNum > 2 ? '0.0%' : undefined,
          alignment: { vertical: 'middle', horizontal: colNum <= 2 ? 'left' : 'right' },
        }
        if (colNum > 2 && cell.value != null) {
          cell.value = (cell.value as number) / 100
        }
      })
      row.height = 16
    })
  }

  // ── Trigger browser download ──────────────────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `control-materiales_${material.material_name.replace(/\s+/g, '-')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
