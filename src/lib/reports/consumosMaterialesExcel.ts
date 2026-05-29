/**
 * ExcelJS workbook — consumos de materiales para contabilidad (mismo lenguaje visual
 * que reportes-clientes / remisiones: DC_DOCUMENT_THEME, encabezados en español).
 */

import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  adjustmentTypeLabelEs,
} from '@/lib/inventory/adjustmentModel'
import {
  eachPlantScope,
  type ConsumosAccountingExcelPayload,
} from '@/lib/procurement/consumosAccountingExcelExport'
import type { LedgerAuditAdjustmentTotals } from '@/lib/inventory/ledgerAuditPeriodTotals'
import {
  adjustmentAuditoriaAbsKgForTotals,
  adjustmentDisplayForConsumos,
} from '@/lib/procurement/openingConsumosMerge'
import {
  DC_DOCUMENT_THEME as C,
  DC_NUMBER_FORMATS as FMT,
  getDocumentContact,
} from '@/lib/reports/branding'
import type { MaterialFlowSummary } from '@/types/inventory'
import { computeBridgeTheoreticalFinalKg } from '@/lib/inventory/theoreticalBridge'

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
  wasteArkikKg: number
  mermaInventarioKg: number
  otrosAjustesAbsKg: number
  entriesKg: number
  /** Σ efecto en inventario con signo por todas las líneas de ajuste (incluye merma). */
  signedAdjustmentEffectsKg: number
  /**
   * Movimiento neto del periodo para el material: entradas + Σ(ajustes con signo) − consumo remisiones − desperdicio Arkik.
   * No es inventario físico final sin saldo inicial; describe cómo cambió el stock según estos movimientos.
   */
  variacionNetaInventarioKg: number
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
          wasteArkikKg: 0,
          mermaInventarioKg: 0,
          otrosAjustesAbsKg: 0,
          entriesKg: 0,
          signedAdjustmentEffectsKg: 0,
          variacionNetaInventarioKg: 0,
        }
        map.set(key, agg)
      }

      agg.consumptionKg += m.total_consumed_kg
      agg.wasteArkikKg += m.total_waste_arkik_kg
      agg.mermaInventarioKg += m.total_merma_inventario_kg
      for (const a of m.adjustments) {
        agg.signedAdjustmentEffectsKg += adjustmentDisplayForConsumos(a).effectSignedKg
        if (a.adjustment_type !== 'waste') {
          agg.otrosAjustesAbsKg += adjustmentAuditoriaAbsKgForTotals(a)
        }
      }
      for (const e of m.entries) {
        agg.entriesKg += e.quantity_received
      }

      agg.variacionNetaInventarioKg =
        agg.entriesKg +
        agg.signedAdjustmentEffectsKg -
        agg.consumptionKg -
        agg.wasteArkikKg

      const code = (m.material_accounting_code ?? '').trim()
      if (code && !agg.clave) agg.clave = code
      if (m.material_name.length > agg.material_name.length) {
        agg.material_name = m.material_name
      }
    }
  }

  const rows = [...map.values()].filter(
    (r) =>
      r.consumptionKg > 1e-9 ||
      r.entriesKg > 1e-9 ||
      r.wasteArkikKg > 1e-9 ||
      r.mermaInventarioKg > 1e-9 ||
      r.otrosAjustesAbsKg > 1e-9 ||
      Math.abs(r.variacionNetaInventarioKg) > 1e-9,
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
      sumW: number
      sumM: number
      sumO: number
      sumE: number
      sumVN: number
    }

/** Agrupa filas por planta e inserta subtotal por planta (ej. total cemento + agua en esa planta). */
function expandPlantMaterialRowsWithSubtotals(rows: PlantMaterialTotalRow[]): ResumenMaterialDisplayRow[] {
  const out: ResumenMaterialDisplayRow[] = []
  let i = 0
  while (i < rows.length) {
    const plant = rows[i].plant_name
    let sumC = 0
    let sumW = 0
    let sumM = 0
    let sumO = 0
    let sumE = 0
    let sumVN = 0
    while (i < rows.length && rows[i].plant_name === plant) {
      out.push({ kind: 'material', pm: rows[i] })
      sumC += rows[i].consumptionKg
      sumW += rows[i].wasteArkikKg
      sumM += rows[i].mermaInventarioKg
      sumO += rows[i].otrosAjustesAbsKg
      sumE += rows[i].entriesKg
      sumVN += rows[i].variacionNetaInventarioKg
      i += 1
    }
    out.push({ kind: 'plant_subtotal', plant_name: plant, sumC, sumW, sumM, sumO, sumE, sumVN })
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
  totalWasteArkikKg: number
  totalMermaInventarioKg: number
  totalOtrosAjustesAbsKg: number
  totalEntradasKg: number
  /** Entradas + Σ efectos de ajustes (signo) − consumo remisiones − desperdicio Arkik (mismo periodo). */
  totalVariacionNetaInventarioKg: number
  /** Σ |impacto en stock| por línea (incluye merma); mismo criterio que la API y la hoja Ajustes. */
  totalAjustesAbsKg: number
  /** Σ efecto en inventario con signo (+ entrada a inventario, − salida). */
  totalAjustesNetKg: number
  remisionesCount: number
  consumoLines: number
  entradaLines: number
  ajusteLines: number
  wasteArkikLines: number
  mermaLines: number
}

function computeAggregates(payload: ConsumosAccountingExcelPayload): Aggregates {
  let totalConsumoKg = 0
  let totalWasteArkikKg = 0
  let totalMermaInventarioKg = 0
  let totalEntradasKg = 0
  let totalAjustesAbsKg = 0
  let totalAjustesNetKg = 0
  let remisionesCount = 0
  let consumoLines = 0
  let entradaLines = 0
  let ajusteLines = 0
  let wasteArkikLines = 0
  let mermaLines = 0

  for (const scope of eachPlantScope(payload)) {
    totalConsumoKg += scope.summary.total_consumption_kg
    totalWasteArkikKg += scope.summary.total_waste_arkik_kg
    totalMermaInventarioKg += scope.summary.total_merma_inventario_kg
    totalEntradasKg += scope.summary.total_entries_kg
    totalAjustesAbsKg += scope.summary.total_adjustments_kg
    totalAjustesNetKg += scope.summary.total_adjustments_net_effect_kg
    remisionesCount += scope.summary.remision_count
    for (const m of scope.materials) {
      consumoLines += m.consumptions.length
      entradaLines += m.entries.length
      ajusteLines += m.adjustments.length
      wasteArkikLines += m.waste_arkik.length
      for (const a of m.adjustments) {
        if (a.adjustment_type === 'waste') mermaLines += 1
      }
    }
  }

  const totalOtrosAjustesAbsKg = Math.max(0, totalAjustesAbsKg - totalMermaInventarioKg)
  const totalVariacionNetaInventarioKg =
    totalEntradasKg + totalAjustesNetKg - totalConsumoKg - totalWasteArkikKg

  return {
    totalConsumoKg,
    totalWasteArkikKg,
    totalMermaInventarioKg,
    totalOtrosAjustesAbsKg,
    totalEntradasKg,
    totalVariacionNetaInventarioKg,
    totalAjustesAbsKg,
    totalAjustesNetKg,
    remisionesCount,
    consumoLines,
    entradaLines,
    ajusteLines,
    wasteArkikLines,
    mermaLines,
  }
}

function materialAccountingCodeByMaterialId(payload: ConsumosAccountingExcelPayload): Map<string, string> {
  const map = new Map<string, string>()
  for (const scope of eachPlantScope(payload)) {
    for (const m of scope.materials) {
      const code = (m.material_accounting_code ?? '').trim()
      if (code && !map.has(m.material_id)) map.set(m.material_id, code)
    }
  }
  return map
}

type BridgeResumenRow = {
  plant_name: string
  material_id: string
  material_name: string
  clave: string
  initial_stock: number
  total_entries: number
  total_manual_additions: number
  total_manual_withdrawals_abs: number
  total_remisiones_consumption: number
  total_waste: number
  theoretical_final_stock: number
}

function ledgerAdjustmentOverride(
  payload: ConsumosAccountingExcelPayload,
  materialId: string,
): LedgerAuditAdjustmentTotals | undefined {
  if (payload.mode !== 'single' && payload.mode !== 'range') return undefined
  return payload.material_ledger_adjustments?.[materialId]
}

function buildBridgeResumenRows(
  payload: ConsumosAccountingExcelPayload,
  flows: MaterialFlowSummary[],
): BridgeResumenRow[] {
  const codeMap = materialAccountingCodeByMaterialId(payload)
  const plantName =
    payload.mode === 'range' || payload.mode === 'single' ? payload.plant_name : ''
  const rows: BridgeResumenRow[] = flows.map((f) => {
    const ledger = ledgerAdjustmentOverride(payload, f.material_id)
    const total_manual_additions = ledger?.adj_positive_kg ?? f.total_manual_additions
    const total_manual_withdrawals_abs =
      ledger?.adj_negative_abs_kg ?? Math.abs(f.total_manual_withdrawals)
    return {
      plant_name: plantName,
      material_id: f.material_id,
      material_name: f.material_name,
      clave: codeMap.get(f.material_id) || '',
      initial_stock: f.initial_stock,
      total_entries: f.total_entries,
      total_manual_additions,
      total_manual_withdrawals_abs,
      total_remisiones_consumption: f.total_remisiones_consumption,
      total_waste: f.total_waste,
      theoretical_final_stock: computeBridgeTheoreticalFinalKg({
        initial_stock_kg: f.initial_stock,
        period_entries_kg: f.total_entries,
        period_adjustments_positive_kg: total_manual_additions,
        period_adjustments_negative_kg: total_manual_withdrawals_abs,
        period_consumption_kg: f.total_remisiones_consumption,
        period_waste_kg: f.total_waste,
      }),
    }
  })
  rows.sort((a, b) => a.material_name.localeCompare(b.material_name, 'es', { sensitivity: 'base' }))
  return rows
}

type BridgeDisplayRow =
  | { kind: 'material'; br: BridgeResumenRow }
  | {
      kind: 'plant_subtotal'
      plant_name: string
      sumI: number
      sumEnt: number
      sumAp: number
      sumAn: number
      sumC: number
      sumW: number
      sumTf: number
    }

function expandBridgeRowsWithSubtotals(rows: BridgeResumenRow[]): BridgeDisplayRow[] {
  const out: BridgeDisplayRow[] = []
  let i = 0
  while (i < rows.length) {
    const plant = rows[i].plant_name
    let sumI = 0
    let sumEnt = 0
    let sumAp = 0
    let sumAn = 0
    let sumC = 0
    let sumW = 0
    let sumTf = 0
    while (i < rows.length && rows[i].plant_name === plant) {
      out.push({ kind: 'material', br: rows[i] })
      sumI += rows[i].initial_stock
      sumEnt += rows[i].total_entries
      sumAp += rows[i].total_manual_additions
      sumAn += rows[i].total_manual_withdrawals_abs
      sumC += rows[i].total_remisiones_consumption
      sumW += rows[i].total_waste
      sumTf += rows[i].theoretical_final_stock
      i += 1
    }
    out.push({
      kind: 'plant_subtotal',
      plant_name: plant,
      sumI,
      sumEnt,
      sumAp,
      sumAn,
      sumC,
      sumW,
      sumTf,
    })
  }
  return out
}

function buildResumenSheetTheoreticalBridge(
  ws: ExcelJS.Worksheet,
  payload: ConsumosAccountingExcelPayload,
  flows: MaterialFlowSummary[],
  agg: Aggregates,
  generatedAt: Date,
): void {
  const contact = getDocumentContact()
  const cols = 10
  ws.columns = [
    { width: 22 },
    { width: 14 },
    { width: 30 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ]

  ws.mergeCells(1, 1, 1, cols)
  ws.getCell(1, 1).value = contact.companyLine
  Object.assign(ws.getCell(1, 1), titleBarStyle())
  ws.getRow(1).height = 22

  ws.mergeCells(2, 1, 2, cols)
  const r2 = ws.getCell(2, 1)
  r2.value = 'Puente de inventario teórico y consumos de materiales'
  Object.assign(r2, sheetSubtitleStyle())
  ws.getRow(2).height = 20

  const periodLabel =
    payload.mode === 'range'
      ? `Del ${formatDisplayDate(payload.date_from)} al ${formatDisplayDate(payload.date_to)}`
      : payload.mode === 'single'
        ? formatDisplayDate(payload.summary.date)
        : formatDisplayDate(payload.date)

  let row = 3
  const meta: [string, string][] = [
    ['Planta(s) / alcance', scopeDescription(payload)],
    ['Periodo de movimientos', periodLabel],
    ['Modelo', 'Mismo cálculo que el dashboard de inventario (capas OPEN / ADJP excluidas según reglas del sistema)'],
    ['Generado', format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: es })],
  ]
  for (const [label, value] of meta) {
    ws.mergeCells(row, 1, row, 2)
    ws.getCell(row, 1).value = `${label}:`
    Object.assign(ws.getCell(row, 1), metaLabelStyle())
    ws.mergeCells(row, 3, row, cols)
    ws.getCell(row, 3).value = value
    Object.assign(ws.getCell(row, 3), metaValueStyle())
    ws.getRow(row).height = 16
    row += 1
  }

  row += 1
  ws.mergeCells(row, 1, row, cols)
  const note = ws.getCell(row, 1)
  const hasLedgerAdj =
    (payload.mode === 'single' || payload.mode === 'range') &&
    !!payload.material_ledger_adjustments &&
    Object.keys(payload.material_ledger_adjustments).length > 0
  note.value =
    'Por material: inventario inicial y existencia teórica final provienen del modelo histórico consolidado (calculateHistoricalInventory). ' +
    'Entradas, consumos por remisión y desperdicio Arkik coinciden con el periodo; las columnas «Ajustes ±» ' +
    (hasLedgerAdj
      ? 'usan los mismos movimientos fusionados que Auditoría de material (capa OPEN + conteo inicial como un solo renglón de ajuste), alineadas al pie Total Ajustes del libro mayor. '
      : 'siguen el desglose del modelo teórico (puede diferir del libro cuando hay capa FIFO de apertura). ') +
    'Por diseño, Inv inicial + Entradas ± Ajustes (auditoría) − Consumo − Desperdicio no tiene por qué igualar al Inv teórico final del modelo cuando hay apertura OPEN; ambas lecturas sirven para fines distintos.'
  Object.assign(note, metaLabelStyle())
  note.alignment = { ...note.alignment, wrapText: true, vertical: 'top', horizontal: 'left' }
  ws.getRow(row).height = hasLedgerAdj ? 96 : 72
  row += 2

  const bridgeRows = buildBridgeResumenRows(payload, flows)

  const sumInitial = flows.reduce((s, f) => s + f.initial_stock, 0)
  const sumEntries = flows.reduce((s, f) => s + f.total_entries, 0)
  const sumAdjPos = bridgeRows.reduce((s, r) => s + r.total_manual_additions, 0)
  const sumAdjNegAbs = bridgeRows.reduce((s, r) => s + r.total_manual_withdrawals_abs, 0)
  const sumConsumo = flows.reduce((s, f) => s + f.total_remisiones_consumption, 0)
  const sumWaste = flows.reduce((s, f) => s + f.total_waste, 0)
  const sumFinal = flows.reduce((s, f) => s + f.theoretical_final_stock, 0)

  ws.mergeCells(row, 1, row, cols)
  ws.getCell(row, 1).value = 'Indicadores — puente teórico (suma por materiales)'
  ws.getCell(row, 1).font = { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.navy) } }
  ws.getRow(row).height = 18
  row += 1

  const kpis: [string, number | string, string][] = [
    ['Σ Inventario inicial (kg)', sumInitial, FMT.currencyNoSign],
    ['Σ Entradas periodo (kg)', sumEntries, FMT.currencyNoSign],
    [
      hasLedgerAdj
        ? 'Σ Ajustes positivos — mismo criterio que Auditoría de material (kg)'
        : 'Σ Ajustes positivos / aumentos (kg)',
      sumAdjPos,
      FMT.currencyNoSign,
    ],
    [
      hasLedgerAdj
        ? 'Σ Ajustes negativos — magnitud, mismo criterio que Auditoría (kg)'
        : 'Σ Ajustes negativos / salidas ajuste — magnitud (kg)',
      sumAdjNegAbs,
      FMT.currencyNoSign,
    ],
    ['Σ Consumo remisiones (kg)', sumConsumo, FMT.currencyNoSign],
    ['Σ Desperdicio Arkik (kg)', sumWaste, FMT.currencyNoSign],
    ['Σ Inventario teórico final (kg)', sumFinal, FMT.currencyNoSign],
    ['Remisiones consideradas (detalle)', agg.remisionesCount, FMT.integer],
    ['Renglones detalle — Consumos por remisión', agg.consumoLines, FMT.integer],
    ['Renglones detalle — Desperdicios (tabla)', agg.wasteArkikLines, FMT.integer],
    ['Renglones detalle — Ajustes', agg.ajusteLines, FMT.integer],
    ['Renglones detalle — Entradas', agg.entradaLines, FMT.integer],
  ]

  const kpiStartRow = row
  kpis.forEach(([label, value, fmt], i) => {
    const r = kpiStartRow + i
    ws.mergeCells(r, 1, r, 3)
    ws.getCell(r, 1).value = label
    Object.assign(ws.getCell(r, 1), kpiLabelStyle())
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
  ws.getCell(row, 1).value = 'Detalle por material — puente teórico'
  Object.assign(ws.getCell(row, 1), sectionBannerStyle())
  ws.getRow(row).height = 22
  row += 1

  ws.mergeCells(row, 1, row, cols)
  ws.getCell(row, 1).value =
    'La suma de «Inventario teórico final» entre materiales no representa un solo inventario físico agregado; sirve para revisar cada insumo.'
  Object.assign(ws.getCell(row, 1), metaLabelStyle())
  ws.getCell(row, 1).alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  ws.getRow(row).height = 28
  row += 1

  const hdr = ws.getRow(row)
  hdr.height = 28
  const headers = [
    'Planta',
    'Clave de producto',
    'Material',
    'Inv. inicial (kg)',
    'Entradas (kg)',
    hasLedgerAdj ? 'Ajustes + (auditoría)' : 'Ajustes + (kg)',
    hasLedgerAdj ? 'Ajustes − (auditoría)' : 'Ajustes − (kg)',
    'Consumo remisiones (kg)',
    'Desperdicio Arkik (kg)',
    'Inv. teórico final (kg)',
  ]
  headers.forEach((h, ci) => {
    const cell = hdr.getCell(ci + 1)
    cell.value = h
    Object.assign(cell, columnHeaderStyle())
  })
  row += 1

  if (bridgeRows.length === 0) {
    ws.mergeCells(row, 1, row, cols)
    ws.getCell(row, 1).value = 'Sin materiales en el modelo teórico para este periodo.'
    Object.assign(ws.getCell(row, 1), metaLabelStyle())
    ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 22
  } else {
    const sumGrandI = bridgeRows.reduce((s, r) => s + r.initial_stock, 0)
    const sumGrandEnt = bridgeRows.reduce((s, r) => s + r.total_entries, 0)
    const sumGrandAp = bridgeRows.reduce((s, r) => s + r.total_manual_additions, 0)
    const sumGrandAn = bridgeRows.reduce((s, r) => s + r.total_manual_withdrawals_abs, 0)
    const sumGrandC = bridgeRows.reduce((s, r) => s + r.total_remisiones_consumption, 0)
    const sumGrandW = bridgeRows.reduce((s, r) => s + r.total_waste, 0)
    const sumGrandTf = bridgeRows.reduce((s, r) => s + r.theoretical_final_stock, 0)

    const displayRows = expandBridgeRowsWithSubtotals(bridgeRows)
    let dataZebra = 0
    displayRows.forEach((entry, idx) => {
      const dr = ws.getRow(row + idx)
      dr.height = entry.kind === 'plant_subtotal' ? 18 : 16

      if (entry.kind === 'plant_subtotal') {
        const pst = plantSubtotalStyle()
        const cells: (string | number)[] = [
          `Subtotal planta — ${entry.plant_name}`,
          '',
          '',
          entry.sumI,
          entry.sumEnt,
          entry.sumAp,
          entry.sumAn,
          entry.sumC,
          entry.sumW,
          entry.sumTf,
        ]
        cells.forEach((v, ci) => {
          const cell = dr.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, pst)
          if (ci >= 3 && typeof v === 'number') {
            cell.numFmt = FMT.currencyNoSign
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
          if (ci === 0) cell.alignment = { horizontal: 'left', vertical: 'middle' }
        })
        return
      }

      const br = entry.br
      const st = dataStyle(dataZebra % 2 === 1)
      dataZebra += 1
      const vals: (string | number)[] = [
        br.plant_name,
        br.clave || '—',
        br.material_name,
        br.initial_stock,
        br.total_entries,
        br.total_manual_additions,
        br.total_manual_withdrawals_abs,
        br.total_remisiones_consumption,
        br.total_waste,
        br.theoretical_final_stock,
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
      ['TOTAL GENERAL', 0],
      ['', 1],
      ['', 2],
      [sumGrandI, 3],
      [sumGrandEnt, 4],
      [sumGrandAp, 5],
      [sumGrandAn, 6],
      [sumGrandC, 7],
      [sumGrandW, 8],
      [sumGrandTf, 9],
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
  ws.getCell(row, 1).value = `${contact.phone}  ·  ${contact.email}  ·  ${contact.web}`
  Object.assign(ws.getCell(row, 1), metaLabelStyle())
  ws.getCell(row, 1).alignment = { horizontal: 'right', vertical: 'middle' }

  ws.properties.tabColor = { argb: argb(C.green) }
}

function buildResumenSheet(
  ws: ExcelJS.Worksheet,
  payload: ConsumosAccountingExcelPayload,
  agg: Aggregates,
  generatedAt: Date,
): void {
  const flowsOpt =
    (payload.mode === 'range' || payload.mode === 'single') &&
    payload.material_flows !== undefined
      ? payload.material_flows
      : null
  if (flowsOpt !== null) {
    buildResumenSheetTheoreticalBridge(ws, payload, flowsOpt, agg, generatedAt)
    return
  }

  const contact = getDocumentContact()
  const cols = 9
  ws.columns = [
    { width: 22 },
    { width: 14 },
    { width: 30 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 20 },
  ]

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
    'La tabla muestra por planta y material los componentes del periodo. «Variación neta inventario» resume el efecto acumulado ' +
    'de estos movimientos: entradas + efectos de ajustes con signo − consumo por remisiones − desperdicio Arkik (merma y demás ajustes van dentro del efecto firmado). ' +
    'Es la variación implícita del periodo, no el inventario físico absoluto al cierre (eso requeriría saldo inicial). ' +
    '«Otros ajustes» sigue siendo magnitud de auditoría sin merma (aperturas: mismo valor que en detalle).'
  Object.assign(note, metaLabelStyle())
  note.alignment = { ...note.alignment, wrapText: true, vertical: 'top', horizontal: 'left' }
  ws.getRow(row).height = 64
  row += 2

  ws.mergeCells(row, 1, row, cols)
  const kpiTitle = ws.getCell(row, 1)
  kpiTitle.value = 'Indicadores generales del periodo'
  kpiTitle.font = { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.navy) } }
  ws.getRow(row).height = 18
  row += 1

  const kpis: [string, number | string, string][] = [
    ['Consumo total remisiones (kg)', agg.totalConsumoKg, FMT.currencyNoSign],
    ['Desperdicio Arkik / waste_materials (kg)', agg.totalWasteArkikKg, FMT.currencyNoSign],
    ['Entradas total inventario (kg)', agg.totalEntradasKg, FMT.currencyNoSign],
    ['Variación neta inventario del periodo (kg)', agg.totalVariacionNetaInventarioKg, FMT.currencyNoSign],
    ['Merma inventario — ajustes tipo merma (kg)', agg.totalMermaInventarioKg, FMT.currencyNoSign],
    ['Otros ajustes — sin tipo merma (kg)', agg.totalOtrosAjustesAbsKg, FMT.currencyNoSign],
    ['Ajustes — impacto neto en inventario (kg, +/−)', agg.totalAjustesNetKg, FMT.currencyNoSign],
    ['Ajustes — Σ magnitud líneas — auditoría (kg)', agg.totalAjustesAbsKg, FMT.currencyNoSign],
    ['Remisiones consideradas', agg.remisionesCount, FMT.integer],
    ['Renglones detalle — Consumos por remisión', agg.consumoLines, FMT.integer],
    ['Renglones detalle — Desperdicios (tabla)', agg.wasteArkikLines, FMT.integer],
    ['Renglones detalle — Ajustes (incl. merma)', agg.ajusteLines, FMT.integer],
    ['Renglones detalle — Entradas', agg.entradaLines, FMT.integer],
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
    'Totales por planta y material — componentes y variación neta de inventario (periodo)'
  Object.assign(secBanner, sectionBannerStyle())
  ws.getRow(row).height = 22
  row += 1

  ws.mergeCells(row, 1, row, cols)
  const secHint = ws.getCell(row, 1)
  secHint.value =
    'Cada insumo aparece por planta. «Subtotal planta» acumula las columnas numéricas de esa planta. ' +
    'Use la hoja «Desperdicios y merma» para el detalle línea por línea de waste_materials y de ajustes tipo merma.'
  Object.assign(secHint, metaLabelStyle())
  secHint.alignment = { ...secHint.alignment, wrapText: true, vertical: 'middle', horizontal: 'left' }
  ws.getRow(row).height = 32
  row += 1

  const plantMaterialRows = computePlantMaterialTotals(payload)
  const hdr = ws.getRow(row)
  hdr.height = 28
  const headers = [
    'Planta',
    'Clave de producto',
    'Material',
    'Consumo remisiones (kg)',
    'Desperdicio Arkik (kg)',
    'Merma inventario (kg)',
    'Otros ajustes (kg)',
    'Entradas (kg)',
    'Variación neta inventario (kg)',
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
    const sumGrandW = plantMaterialRows.reduce((s, pm) => s + pm.wasteArkikKg, 0)
    const sumGrandM = plantMaterialRows.reduce((s, pm) => s + pm.mermaInventarioKg, 0)
    const sumGrandO = plantMaterialRows.reduce((s, pm) => s + pm.otrosAjustesAbsKg, 0)
    const sumGrandE = plantMaterialRows.reduce((s, pm) => s + pm.entriesKg, 0)
    const sumGrandVN = plantMaterialRows.reduce((s, pm) => s + pm.variacionNetaInventarioKg, 0)
    const displayRows = expandPlantMaterialRowsWithSubtotals(plantMaterialRows)

    let dataZebra = 0
    displayRows.forEach((entry, idx) => {
      const dr = ws.getRow(row + idx)
      dr.height = entry.kind === 'plant_subtotal' ? 18 : 16

      if (entry.kind === 'plant_subtotal') {
        const pst = plantSubtotalStyle()
        const label = `Subtotal planta — ${entry.plant_name}`
        const cells: (string | number)[] = [
          label,
          '',
          '',
          entry.sumC,
          entry.sumW,
          entry.sumM,
          entry.sumO,
          entry.sumE,
          entry.sumVN,
        ]
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
        pm.wasteArkikKg,
        pm.mermaInventarioKg,
        pm.otrosAjustesAbsKg,
        pm.entriesKg,
        pm.variacionNetaInventarioKg,
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
      [sumGrandW, 4],
      [sumGrandM, 5],
      [sumGrandO, 6],
      [sumGrandE, 7],
      [sumGrandVN, 8],
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

function excelInventoryQtyCell(v: number | null | undefined): number | string {
  if (v == null) return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n : '—'
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
    'Valor en reporte (kg)',
    'Inv. antes (kg)',
    'Inv. después (kg)',
    'Comentarios',
    'Hora',
  ]
  const colCount = headers.length
  const ws = wb.addWorksheet('Ajustes', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
  ws.columns = [
    { width: 11 },
    { width: 22 },
    { width: 28 },
    { width: 10 },
    { width: 16 },
    { width: 28 },
    { width: 26 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 36 },
    { width: 11 },
  ]

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

  const noteRowIndex = headerRow + 1
  ws.mergeCells(noteRowIndex, 1, noteRowIndex, colCount)
  const colNote = ws.getCell(noteRowIndex, 1)
  colNote.value =
    '«Valor en reporte»: cantidad del movimiento o, en apertura de saldo, el inventario resultante del conteo mostrado en pantalla. ' +
    '«Inv. antes / después»: existencias en sistema antes y después del registro (cuando existen); la diferencia explica el cierre contable sin usar una sola columna de «efecto».'
  Object.assign(colNote, metaLabelStyle())
  colNote.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  ws.getRow(noteRowIndex).height = 44

  const dataStartRow = headerRow + 2

  let ri = 0
  for (const scope of eachPlantScope(payload)) {
    const concepto = (scope.summary.accounting_concept ?? '').trim() || '—'
    const almacen =
      scope.summary.warehouse_number != null ? String(scope.summary.warehouse_number) : '—'
    for (const m of scope.materials) {
      const clave = (m.material_accounting_code ?? '').trim() || '—'
      for (const a of m.adjustments) {
        const disp = adjustmentDisplayForConsumos(a)
        const row = ws.getRow(dataStartRow + ri)
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
          disp.magnitudeKg,
          excelInventoryQtyCell(a.inventory_before ?? null),
          excelInventoryQtyCell(a.inventory_after ?? null),
          a.reference_notes ?? '—',
          a.adjustment_time ?? '—',
        ]
        vals.forEach((v, ci) => {
          const cell = row.getCell(ci + 1)
          cell.value = v
          Object.assign(cell, st)
          if (ci === 0) cell.numFmt = FMT.date
          if ((ci === 7 || ci === 8 || ci === 9) && typeof v === 'number') {
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
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: noteRowIndex, activeCell: `A${dataStartRow}` }]
  ws.properties.tabColor = { argb: argb(C.navy) }

  if (ri === 0) {
    ws.mergeCells(dataStartRow, 1, dataStartRow, colCount)
    const ec = ws.getCell(dataStartRow, 1)
    ec.value = 'Sin ajustes de inventario en el periodo seleccionado.'
    Object.assign(ec, metaLabelStyle())
    ec.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(dataStartRow).height = 22
  }
}

function buildDesperdiciosSheet(
  wb: ExcelJS.Workbook,
  payload: ConsumosAccountingExcelPayload,
  generatedAt: Date,
): void {
  const headers = [
    'Fecha',
    'Planta',
    'Concepto contable (planta)',
    'Almacén',
    'Origen del registro',
    'Clave de producto',
    'Material',
    'Referencia remisión / ticket',
    'Código material (Arkik)',
    'Cantidad (kg)',
    'Motivo / tipo',
    'Notas',
    'ID sistema',
  ]
  const colCount = headers.length
  const ws = wb.addWorksheet('Desperdicios y merma', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  })
  ws.columns = [
    { width: 11 },
    { width: 22 },
    { width: 28 },
    { width: 10 },
    { width: 26 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 28 },
    { width: 36 },
    { width: 36 },
  ]

  const headerRow = applyDetailSheetBanner(
    ws,
    colCount,
    {
      sheetTitle: 'Detalle — Desperdicios (Arkik) y merma de inventario',
      periodLabel: periodLabelForPayload(payload),
      scopeLabel: scopeDescription(payload),
    },
    getDocumentContact(),
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

      for (const w of m.waste_arkik) {
        const row = ws.getRow(headerRow + 1 + ri)
        row.height = 15
        const st = dataStyle(ri % 2 === 1)
        const vals: ExcelJS.CellValue[] = [
          excelDate(scope.summary.date),
          scope.plant_name,
          concepto,
          almacen,
          'Arkik — waste_materials',
          clave,
          m.material_name,
          w.remision_number,
          w.material_code ?? '—',
          w.waste_amount,
          w.waste_reason,
          w.notes ?? '—',
          w.id,
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

      for (const a of m.adjustments) {
        if (a.adjustment_type !== 'waste') continue
        const row = ws.getRow(headerRow + 1 + ri)
        row.height = 15
        const st = dataStyle(ri % 2 === 1)
        const qty = Math.abs(Number(a.quantity_adjusted))
        const vals: ExcelJS.CellValue[] = [
          excelDate(scope.summary.date),
          scope.plant_name,
          concepto,
          almacen,
          'Ajuste — merma inventario',
          clave,
          m.material_name,
          '—',
          '—',
          qty,
          adjustmentTypeLabelEs(a.adjustment_type),
          a.reference_notes ?? '—',
          a.id,
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
    ec.value =
      'Sin registros de desperdicio en waste_materials ni ajustes tipo merma en el periodo seleccionado.'
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
  buildDesperdiciosSheet(wb, payload, generatedAt)
  buildEntradasSheet(wb, payload, generatedAt)
  buildAjustesSheet(wb, payload, generatedAt)

  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}
