/**
 * ExcelJS workbook — consumos de materiales para contabilidad (mismo lenguaje visual
 * que reportes-clientes / remisiones: DC_DOCUMENT_THEME, encabezados en español).
 */

import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  adjustmentTypeLabelEs,
  signedQuantityForStockEffect,
} from '@/lib/inventory/adjustmentModel'
import {
  eachPlantScope,
  type ConsumosAccountingExcelPayload,
} from '@/lib/procurement/consumosAccountingExcelExport'
import {
  DC_DOCUMENT_THEME as C,
  DC_NUMBER_FORMATS as FMT,
  getDocumentContact,
} from '@/lib/reports/branding'

function argb(hex: string, alpha = 'FF'): string {
  return alpha + hex.replace('#', '')
}

function titleBarStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  }
}

function sheetSubtitleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 11, name: 'Calibri', color: { argb: argb(C.navy) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  }
}

function metaLabelStyle(): Partial<ExcelJS.Style> {
  return {
    font: { italic: true, size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
  }
}

function metaValueStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.textPrimary) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
  }
}

function columnHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { argb: argb(C.green) } },
    },
  }
}

function dataStyle(isAlt: boolean): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, name: 'Calibri', color: { argb: argb(C.textSecondary) } },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isAlt ? argb(C.rowAlternate) : argb(C.white) },
    },
    alignment: { vertical: 'middle' },
    border: {
      bottom: { style: 'hair', color: { argb: argb(C.borderLight) } },
    },
  }
}

function kpiLabelStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  }
}

function kpiValueStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 11, name: 'Calibri', color: { argb: argb(C.navy) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: { bottom: { style: 'medium', color: { argb: argb(C.navy) } } },
  }
}

function sectionBannerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
  }
}

function grandTotalResumenStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle' },
    border: {
      top: { style: 'medium', color: { argb: argb(C.green) } },
    },
  }
}

function plantSubtotalStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, name: 'Calibri', color: { argb: argb(C.navy) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.groupHeaderTint) } },
    alignment: { vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: argb(C.borderMedium) } },
      bottom: { style: 'thin', color: { argb: argb(C.borderMedium) } },
    },
  }
}

type PlantMaterialTotalRow = {
  plant_id: string
  plant_name: string
  material_id: string
  material_name: string
  clave: string
  consumptionKg: number
  entriesKg: number
  adjustmentsAbsKg: number
}

/** Una fila por combinación planta + material, sumando todos los días / plantas del payload. */
function computePlantMaterialTotals(payload: ConsumosAccountingExcelPayload): PlantMaterialTotalRow[] {
  const map = new Map<string, PlantMaterialTotalRow>()

  for (const scope of eachPlantScope(payload)) {
    for (const m of scope.materials) {
      const key = `${scope.plant_id}::${m.material_id}`
      let agg = map.get(key)
      if (!agg) {
        agg = {
          plant_id: scope.plant_id,
          plant_name: scope.plant_name,
          material_id: m.material_id,
          material_name: m.material_name,
          clave: (m.material_accounting_code ?? '').trim(),
          consumptionKg: 0,
          entriesKg: 0,
          adjustmentsAbsKg: 0,
        }
        map.set(key, agg)
      }

      agg.consumptionKg += m.total_consumed_kg
      for (const e of m.entries) {
        agg.entriesKg += e.quantity_received
      }
      for (const a of m.adjustments) {
        agg.adjustmentsAbsKg += Math.abs(a.quantity_adjusted)
      }

      const code = (m.material_accounting_code ?? '').trim()
      if (code && !agg.clave) agg.clave = code
      if (m.material_name.length > agg.material_name.length) {
        agg.material_name = m.material_name
      }
    }
  }

  const rows = [...map.values()].filter(
    (r) => r.consumptionKg > 1e-9 || r.entriesKg > 1e-9 || r.adjustmentsAbsKg > 1e-9
  )

  rows.sort((a, b) => {
    const byPlant = a.plant_name.localeCompare(b.plant_name, 'es', { sensitivity: 'base' })
    if (byPlant !== 0) return byPlant
    return a.material_name.localeCompare(b.material_name, 'es', { sensitivity: 'base' })
  })

  return rows
}

type ResumenMaterialDisplayRow =
  | { kind: 'material'; pm: PlantMaterialTotalRow }
  | {
      kind: 'plant_subtotal'
      plant_name: string
      sumC: number
      sumE: number
      sumA: number
    }

/** Agrupa filas por planta e inserta subtotal por planta (ej. total cemento + agua en esa planta). */
function expandPlantMaterialRowsWithSubtotals(rows: PlantMaterialTotalRow[]): ResumenMaterialDisplayRow[] {
  const out: ResumenMaterialDisplayRow[] = []
  let i = 0
  while (i < rows.length) {
    const plant = rows[i].plant_name
    let sumC = 0
    let sumE = 0
    let sumA = 0
    while (i < rows.length && rows[i].plant_name === plant) {
      out.push({ kind: 'material', pm: rows[i] })
      sumC += rows[i].consumptionKg
      sumE += rows[i].entriesKg
      sumA += rows[i].adjustmentsAbsKg
      i += 1
    }
    out.push({ kind: 'plant_subtotal', plant_name: plant, sumC, sumE, sumA })
  }
  return out
}

function scopeDescription(payload: ConsumosAccountingExcelPayload): string {
  if (payload.mode === 'single') return payload.plant_name
  if (payload.mode === 'all') return `Todas las plantas activas (${payload.plants.length})`
  return `${payload.plant_name} · del ${formatDisplayDate(payload.date_from)} al ${formatDisplayDate(payload.date_to)}`
}

function formatDisplayDate(ymd: string): string {
  try {
    return format(new Date(`${ymd}T12:00:00`), 'dd/MM/yyyy', { locale: es })
  } catch {
    return ymd
  }
}

function excelDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`)
}

type Aggregates = {
  totalConsumoKg: number
  totalEntradasKg: number
  totalAjustesAbsKg: number
  remisionesCount: number
  consumoLines: number
  entradaLines: number
  ajusteLines: number
}

function computeAggregates(payload: ConsumosAccountingExcelPayload): Aggregates {
  let totalConsumoKg = 0
  let totalEntradasKg = 0
  let totalAjustesAbsKg = 0
  let remisionesCount = 0
  let consumoLines = 0
  let entradaLines = 0
  let ajusteLines = 0

  for (const scope of eachPlantScope(payload)) {
    totalConsumoKg += scope.summary.total_consumption_kg
    totalEntradasKg += scope.summary.total_entries_kg
    totalAjustesAbsKg += scope.summary.total_adjustments_kg
    remisionesCount += scope.summary.remision_count
    for (const m of scope.materials) {
      consumoLines += m.consumptions.length
      entradaLines += m.entries.length
      ajusteLines += m.adjustments.length
    }
  }

  return {
    totalConsumoKg,
    totalEntradasKg,
    totalAjustesAbsKg,
    remisionesCount,
    consumoLines,
    entradaLines,
    ajusteLines,
  }
}

function buildResumenSheet(
  ws: ExcelJS.Worksheet,
  payload: ConsumosAccountingExcelPayload,
  agg: Aggregates,
  generatedAt: Date,
): void {
  const contact = getDocumentContact()
  const cols = 6
  ws.columns = [{ width: 22 }, { width: 14 }, { width: 34 }, { width: 22 }, { width: 18 }, { width: 22 }]

  ws.mergeCells(1, 1, 1, cols)
  const r1 = ws.getCell(1, 1)
  r1.value = contact.companyLine
  Object.assign(r1, titleBarStyle())
  ws.getRow(1).height = 22

  ws.mergeCells(2, 1, 2, cols)
  const r2 = ws.getCell(2, 1)
  r2.value = 'Reporte de consumos de materiales e inventarios'
  Object.assign(r2, sheetSubtitleStyle())
  ws.getRow(2).height = 20

  const periodLabel =
    payload.mode === 'range'
      ? `Del ${formatDisplayDate(payload.date_from)} al ${formatDisplayDate(payload.date_to)}`
      : payload.mode === 'single'
        ? formatDisplayDate(payload.summary.date)
        : formatDisplayDate(payload.date)

  const meta: [string, string][] = [
    ['Planta(s) / alcance', scopeDescription(payload)],
    ['Periodo de movimientos', periodLabel],
    [
      'Generado',
      format(generatedAt, "dd/MM/yyyy HH:mm", { locale: es }),
    ],
  ]

  let row = 3
  for (const [label, value] of meta) {
    ws.mergeCells(row, 1, row, 2)
    const lc = ws.getCell(row, 1)
    lc.value = `${label}:`
    Object.assign(lc, metaLabelStyle())

    ws.mergeCells(row, 3, row, cols)
    const vc = ws.getCell(row, 3)
    vc.value = value
    Object.assign(vc, metaValueStyle())
    ws.getRow(row).height = 16
    row += 1
  }

  row += 1
  ws.mergeCells(row, 1, row, cols)
  const note = ws.getCell(row, 1)
  note.value =
    'La tabla «Totales por planta y material» es el resumen que suele solicitar contabilidad: kilogramos ' +
    'consumidos en producción (remisiones) por cada insumo y por planta en el periodo. Las columnas de entradas ' +
    'y ajustes permiten contrastar compras/recepciones y movimientos de inventario en el mismo periodo. ' +
    'La clave de producto corresponde al catálogo de materiales en el sistema.'
  Object.assign(note, metaLabelStyle())
  note.alignment = { ...note.alignment, wrapText: true, vertical: 'top', horizontal: 'left' }
  ws.getRow(row).height = 56
  row += 2

  ws.mergeCells(row, 1, row, cols)
  const kpiTitle = ws.getCell(row, 1)
  kpiTitle.value = 'Indicadores generales del periodo'
  kpiTitle.font = { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.navy) } }
  ws.getRow(row).height = 18
  row += 1

  const kpis: [string, number | string, string][] = [
    ['Consumo total remisiones (kg)', agg.totalConsumoKg, FMT.currencyNoSign],
    ['Entradas total inventario (kg)', agg.totalEntradasKg, FMT.currencyNoSign],
    ['Ajustes — magnitud absoluta total (kg)', agg.totalAjustesAbsKg, FMT.currencyNoSign],
    ['Remisiones consideradas', agg.remisionesCount, FMT.integer],
    ['Renglones detalle — Consumos', agg.consumoLines, FMT.integer],
    ['Renglones detalle — Entradas', agg.entradaLines, FMT.integer],
    ['Renglones detalle — Ajustes', agg.ajusteLines, FMT.integer],
  ]

  const kpiStartRow = row
  kpis.forEach(([label, value, fmt], i) => {
    const r = kpiStartRow + i
    ws.mergeCells(r, 1, r, 3)
    const l = ws.getCell(r, 1)
    l.value = label
    Object.assign(l, kpiLabelStyle())

    ws.mergeCells(r, 4, r, cols)
    const v = ws.getCell(r, 4)
    v.value = value as ExcelJS.CellValue
    v.numFmt = fmt
    Object.assign(v, kpiValueStyle())
    v.alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getRow(r).height = 18
  })

  row = kpiStartRow + kpis.length + 2

  ws.mergeCells(row, 1, row, cols)
  const secBanner = ws.getCell(row, 1)
  secBanner.value =
    'Totales por planta y material — «¿Cuánto se consumió de cada insumo en cada planta?»'
  Object.assign(secBanner, sectionBannerStyle())
  ws.getRow(row).height = 22
  row += 1

  ws.mergeCells(row, 1, row, cols)
  const secHint = ws.getCell(row, 1)
  secHint.value =
    'Cada material aparece en una fila con su planta. Al final de cada planta verá un «Subtotal planta» ' +
    '(suma de consumos, entradas y ajustes de esa planta). La columna «Consumo remisiones» son kilogramos aplicados a producción.'
  Object.assign(secHint, metaLabelStyle())
  secHint.alignment = { ...secHint.alignment, wrapText: true, vertical: 'middle', horizontal: 'left' }
  ws.getRow(row).height = 28
  row += 1

  const plantMaterialRows = computePlantMaterialTotals(payload)
  const hdr = ws.getRow(row)
  hdr.height = 28
  const headers = [
    'Planta',
    'Clave de producto',
    'Material',
    'Consumo remisiones (kg)',
    'Entradas (kg)',
    'Ajustes (valor absoluto, kg)',
  ]
  headers.forEach((h, ci) => {
    const cell = hdr.getCell(ci + 1)
    cell.value = h
    Object.assign(cell, columnHeaderStyle())
  })
  row += 1

  if (plantMaterialRows.length === 0) {
    ws.mergeCells(row, 1, row, cols)
    const empty = ws.getCell(row, 1)
    empty.value = 'Sin movimientos en el periodo seleccionado.'
    Object.assign(empty, metaLabelStyle())
    empty.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
    row += 2
  } else {
    const sumGrandC = plantMaterialRows.reduce((s, pm) => s + pm.consumptionKg, 0)
    const sumGrandE = plantMaterialRows.reduce((s, pm) => s + pm.entriesKg, 0)
    const sumGrandA = plantMaterialRows.reduce((s, pm) => s + pm.adjustmentsAbsKg, 0)
    const displayRows = expandPlantMaterialRowsWithSubtotals(plantMaterialRows)

    let dataZebra = 0
    displayRows.forEach((entry, idx) => {
      const dr = ws.getRow(row + idx)
      dr.height = entry.kind === 'plant_subtotal' ? 18 : 16

      if (entry.kind === 'plant_subtotal') {
        const pst = plantSubtotalStyle()
        const label = `Subtotal planta — ${entry.plant_name}`
        const cells: (string | number)[] = [label, '', '', entry.sumC, entry.sumE, entry.sumA]
        cells.forEach((v, ci) => {
          const cell = dr.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, pst)
          if (ci >= 3 && typeof v === 'number') {
            cell.numFmt = FMT.currencyNoSign
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
          if (ci === 0) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' }
          }
        })
        return
      }

      const pm = entry.pm
      const st = dataStyle(dataZebra % 2 === 1)
      dataZebra += 1
      const vals: (string | number)[] = [
        pm.plant_name,
        pm.clave || '—',
        pm.material_name,
        pm.consumptionKg,
        pm.entriesKg,
        pm.adjustmentsAbsKg,
      ]
      vals.forEach((v, ci) => {
        const cell = dr.getCell(ci + 1)
        cell.value = v
        Object.assign(cell, st)
        if (ci >= 3) {
          cell.numFmt = FMT.currencyNoSign
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
        }
      })
    })
    row += displayRows.length

    const tr = ws.getRow(row)
    tr.height = 20
    const gt = grandTotalResumenStyle()
    const totalCells: [string | number, number][] = [
      ['TOTAL GENERAL (todas las plantas)', 0],
      ['', 1],
      ['', 2],
      [sumGrandC, 3],
      [sumGrandE, 4],
      [sumGrandA, 5],
    ]
    totalCells.forEach(([val, ci]) => {
      const cell = tr.getCell(ci + 1)
      cell.value = val as ExcelJS.CellValue
      Object.assign(cell, gt)
      if (typeof val === 'number') {
        cell.numFmt = FMT.currencyNoSign
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if (ci === 0) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
    })
    row += 1
  }

  row += 1
  ws.mergeCells(row, 1, row, cols)
  const foot = ws.getCell(row, 1)
  foot.value = `${contact.phone}  ·  ${contact.email}  ·  ${contact.web}`
  Object.assign(foot, metaLabelStyle())
  foot.alignment = { horizontal: 'right', vertical: 'middle' }

  ws.properties.tabColor = { argb: argb(C.green) }
}

type DetailHeaderContext = {
  sheetTitle: string
  periodLabel: string
  scopeLabel: string
}

function applyDetailSheetBanner(
  ws: ExcelJS.Worksheet,
  colCount: number,
  ctx: DetailHeaderContext,
  contact: ReturnType<typeof getDocumentContact>,
  generatedAt: Date,
): number {
  ws.mergeCells(1, 1, 1, colCount)
  const c1 = ws.getCell(1, 1)
  c1.value = contact.companyLine
  Object.assign(c1, titleBarStyle())
  ws.getRow(1).height = 22

  ws.mergeCells(2, 1, 2, colCount)
  const c2 = ws.getCell(2, 1)
  c2.value = ctx.sheetTitle
  Object.assign(c2, sheetSubtitleStyle())
  ws.getRow(2).height = 18

  ws.mergeCells(3, 1, 3, colCount)
  const c3 = ws.getCell(3, 1)
  c3.value = `Periodo: ${ctx.periodLabel}  ·  ${ctx.scopeLabel}`
  Object.assign(c3, metaValueStyle())
  ws.getRow(3).height = 16

  ws.mergeCells(4, 1, 4, colCount)
  const c4 = ws.getCell(4, 1)
  c4.value = `Generado: ${format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: es })}`
  Object.assign(c4, metaLabelStyle())
  c4.alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getRow(4).height = 14

  ws.getRow(5).height = 6
  return 6
}

function periodLabelForPayload(payload: ConsumosAccountingExcelPayload): string {
  if (payload.mode === 'range')
    return `Del ${formatDisplayDate(payload.date_from)} al ${formatDisplayDate(payload.date_to)}`
  if (payload.mode === 'single') return formatDisplayDate(payload.summary.date)
  return formatDisplayDate(payload.date)
}

function buildConsumosDetailSheet(
  wb: ExcelJS.Workbook,
  payload: ConsumosAccountingExcelPayload,
  generatedAt: Date,
): void {
  const headers = [
    'Fecha',
    'Planta',
    'Concepto contable (planta)',
    'Almacén',
    'Clave de producto',
    'Material',
    'Folio remisión',
    'Cliente',
    'Obra',
    'Receta',
    "Resistencia f'c (MPa)",
    'Volumen fabricado (m³)',
    'Hora de carga',
    'Teórico (kg)',
    'Consumido real (kg)',
    'Ajuste batido (kg)',
    'ID remisión (sistema)',
  ]
  const colCount = headers.length
  const ws = wb.addWorksheet('Consumos por remisión', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })
  ws.columns = [
    { width: 11 },
    { width: 22 },
    { width: 28 },
    { width: 10 },
    { width: 16 },
    { width: 28 },
    { width: 14 },
    { width: 26 },
    { width: 22 },
    { width: 12 },
    { width: 12 },
    { width: 11 },
    { width: 11 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 36 },
  ]

  const contact = getDocumentContact()
  let headerRow = applyDetailSheetBanner(
    ws,
    colCount,
    {
      sheetTitle: 'Detalle — Consumos por remisión',
      periodLabel: periodLabelForPayload(payload),
      scopeLabel: scopeDescription(payload),
    },
    contact,
    generatedAt,
  )

  const hr = ws.getRow(headerRow)
  hr.height = 26
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = h
    Object.assign(cell, columnHeaderStyle())
  })

  let ri = 0
  for (const scope of eachPlantScope(payload)) {
    const concepto = (scope.summary.accounting_concept ?? '').trim() || '—'
    const almacen =
      scope.summary.warehouse_number != null ? String(scope.summary.warehouse_number) : '—'

    for (const m of scope.materials) {
      const clave = (m.material_accounting_code ?? '').trim() || '—'
      for (const c of m.consumptions) {
        const row = ws.getRow(headerRow + 1 + ri)
        row.height = 15
        const isAlt = ri % 2 === 1
        const st = dataStyle(isAlt)
        const vals: ExcelJS.CellValue[] = [
          excelDate(scope.summary.date),
          scope.plant_name,
          concepto,
          almacen,
          clave,
          m.material_name,
          c.remision_number,
          c.client_name ?? '—',
          c.construction_site ?? '—',
          c.recipe_code ?? '—',
          c.strength_fc != null ? Number(c.strength_fc) : '—',
          c.volumen_remision_m3 != null ? Number(c.volumen_remision_m3) : '',
          c.hora_carga ?? '—',
          c.cantidad_teorica,
          c.cantidad_real,
          c.ajuste,
          c.remision_id,
        ]
        vals.forEach((v, ci) => {
          const cell = row.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, st)
          if (ci === 0) cell.numFmt = FMT.date
          if ([13, 14, 15].includes(ci)) {
            cell.numFmt = FMT.currencyNoSign
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
          if (ci === 11 && typeof v === 'number') {
            cell.numFmt = FMT.volume
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
          if (ci === 10 && typeof v === 'number') {
            cell.numFmt = FMT.integer
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }
        })
        ri += 1
      }
    }
  }

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow, activeCell: `A${headerRow + 1}` }]
  ws.properties.tabColor = { argb: argb(C.navy) }

  if (ri === 0) {
    ws.mergeCells(headerRow + 1, 1, headerRow + 1, colCount)
    const ec = ws.getCell(headerRow + 1, 1)
    ec.value = 'Sin movimientos de consumo por remisión en el periodo seleccionado.'
    Object.assign(ec, metaLabelStyle())
    ec.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(headerRow + 1).height = 22
  }
}

function buildEntradasSheet(wb: ExcelJS.Workbook, payload: ConsumosAccountingExcelPayload, generatedAt: Date): void {
  const headers = [
    'Fecha',
    'Planta',
    'Concepto contable (planta)',
    'Almacén',
    'Clave de producto',
    'Material',
    'Folio entrada',
    'Proveedor',
    'Factura / documento',
    'Cantidad recibida (kg)',
    'Hora',
  ]
  const colCount = headers.length
  const ws = wb.addWorksheet('Entradas', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
  ws.columns = [{ width: 11 }, { width: 22 }, { width: 28 }, { width: 10 }, { width: 16 }, { width: 28 }, { width: 14 }, { width: 26 }, { width: 18 }, { width: 16 }, { width: 11 }]

  const headerRow = applyDetailSheetBanner(
    ws,
    colCount,
    {
      sheetTitle: 'Detalle — Entradas de inventario',
      periodLabel: periodLabelForPayload(payload),
      scopeLabel: scopeDescription(payload),
    },
    getDocumentContact(),
    generatedAt,
  )

  const hr = ws.getRow(headerRow)
  hr.height = 24
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = h
    Object.assign(cell, columnHeaderStyle())
  })

  let ri = 0
  for (const scope of eachPlantScope(payload)) {
    const concepto = (scope.summary.accounting_concept ?? '').trim() || '—'
    const almacen =
      scope.summary.warehouse_number != null ? String(scope.summary.warehouse_number) : '—'
    for (const m of scope.materials) {
      const clave = (m.material_accounting_code ?? '').trim() || '—'
      for (const e of m.entries) {
        const row = ws.getRow(headerRow + 1 + ri)
        row.height = 15
        const st = dataStyle(ri % 2 === 1)
        const vals: ExcelJS.CellValue[] = [
          excelDate(scope.summary.date),
          scope.plant_name,
          concepto,
          almacen,
          clave,
          m.material_name,
          e.entry_number,
          e.supplier_name ?? '—',
          e.supplier_invoice ?? '—',
          e.quantity_received,
          e.entry_time ?? '—',
        ]
        vals.forEach((v, ci) => {
          const cell = row.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, st)
          if (ci === 0) cell.numFmt = FMT.date
          if (ci === 9) {
            cell.numFmt = FMT.currencyNoSign
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        ri += 1
      }
    }
  }

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow, activeCell: `A${headerRow + 1}` }]
  ws.properties.tabColor = { argb: argb(C.navy) }

  if (ri === 0) {
    ws.mergeCells(headerRow + 1, 1, headerRow + 1, colCount)
    const ec = ws.getCell(headerRow + 1, 1)
    ec.value = 'Sin entradas de materiales en el periodo seleccionado.'
    Object.assign(ec, metaLabelStyle())
    ec.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(headerRow + 1).height = 22
  }
}

function buildAjustesSheet(wb: ExcelJS.Workbook, payload: ConsumosAccountingExcelPayload, generatedAt: Date): void {
  const headers = [
    'Fecha',
    'Planta',
    'Concepto contable (planta)',
    'Almacén',
    'Clave de producto',
    'Material',
    'Tipo de ajuste',
    'Cantidad registrada (kg)',
    'Efecto en existencias (kg)',
    'Comentarios',
    'Hora',
  ]
  const colCount = headers.length
  const ws = wb.addWorksheet('Ajustes', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
  ws.columns = [{ width: 11 }, { width: 22 }, { width: 28 }, { width: 10 }, { width: 16 }, { width: 28 }, { width: 26 }, { width: 18 }, { width: 20 }, { width: 36 }, { width: 11 }]

  const headerRow = applyDetailSheetBanner(
    ws,
    colCount,
    {
      sheetTitle: 'Detalle — Ajustes de inventario',
      periodLabel: periodLabelForPayload(payload),
      scopeLabel: scopeDescription(payload),
    },
    getDocumentContact(),
    generatedAt,
  )

  const hr = ws.getRow(headerRow)
  hr.height = 24
  headers.forEach((h, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = h
    Object.assign(cell, columnHeaderStyle())
  })

  let ri = 0
  for (const scope of eachPlantScope(payload)) {
    const concepto = (scope.summary.accounting_concept ?? '').trim() || '—'
    const almacen =
      scope.summary.warehouse_number != null ? String(scope.summary.warehouse_number) : '—'
    for (const m of scope.materials) {
      const clave = (m.material_accounting_code ?? '').trim() || '—'
      for (const a of m.adjustments) {
        const efecto = signedQuantityForStockEffect(a.adjustment_type, a.quantity_adjusted)
        const row = ws.getRow(headerRow + 1 + ri)
        row.height = 15
        const st = dataStyle(ri % 2 === 1)
        const vals: ExcelJS.CellValue[] = [
          excelDate(scope.summary.date),
          scope.plant_name,
          concepto,
          almacen,
          clave,
          m.material_name,
          adjustmentTypeLabelEs(a.adjustment_type),
          a.quantity_adjusted,
          efecto,
          a.reference_notes ?? '—',
          a.adjustment_time ?? '—',
        ]
        vals.forEach((v, ci) => {
          const cell = row.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, st)
          if (ci === 0) cell.numFmt = FMT.date
          if (ci === 7 || ci === 8) {
            cell.numFmt = FMT.currencyNoSign
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        ri += 1
      }
    }
  }

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow, activeCell: `A${headerRow + 1}` }]
  ws.properties.tabColor = { argb: argb(C.navy) }

  if (ri === 0) {
    ws.mergeCells(headerRow + 1, 1, headerRow + 1, colCount)
    const ec = ws.getCell(headerRow + 1, 1)
    ec.value = 'Sin ajustes de inventario en el periodo seleccionado.'
    Object.assign(ec, metaLabelStyle())
    ec.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(headerRow + 1).height = 22
  }
}

export async function buildConsumosMaterialesExcel(
  payload: ConsumosAccountingExcelPayload,
  opts?: { generatedAt?: Date },
): Promise<ArrayBuffer> {
  const generatedAt = opts?.generatedAt ?? new Date()
  const agg = computeAggregates(payload)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'DC Concretos'
  wb.lastModifiedBy = 'Centro de compras — Finanzas'
  wb.created = generatedAt
  wb.modified = generatedAt

  const wsResumen = wb.addWorksheet('Resumen')
  buildResumenSheet(wsResumen, payload, agg, generatedAt)

  buildConsumosDetailSheet(wb, payload, generatedAt)
  buildEntradasSheet(wb, payload, generatedAt)
  buildAjustesSheet(wb, payload, generatedAt)

  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}
