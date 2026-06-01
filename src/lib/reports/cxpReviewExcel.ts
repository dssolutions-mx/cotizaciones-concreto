/**
 * ExcelJS — informe integral Cuentas por Pagar (revisión contable / admin).
 * Mismo lenguaje visual que reportes-clientes e inventario (DC_DOCUMENT_THEME).
 */

import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CxpReviewExportData } from '@/lib/ap/cxpReviewExportData'
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
    border: { bottom: { style: 'medium', color: { argb: argb(C.green) } } },
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
    border: { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } },
  }
}

function subtotalStyle(): Partial<ExcelJS.Style> {
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

function grandTotalStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle' },
    border: { top: { style: 'medium', color: { argb: argb(C.green) } } },
  }
}

function excelDate(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00`)
}

type ColDef = {
  header: string
  width: number
  fmt?: string
  get: (row: unknown) => ExcelJS.CellValue
}

function applySheetBanner(
  ws: ExcelJS.Worksheet,
  colCount: number,
  sheetTitle: string,
  scopeLabel: string,
  generatedAt: Date,
): number {
  const contact = getDocumentContact()
  ws.mergeCells(1, 1, 1, colCount)
  Object.assign(ws.getCell(1, 1), titleBarStyle())
  ws.getCell(1, 1).value = contact.companyLine
  ws.getRow(1).height = 22

  ws.mergeCells(2, 1, 2, colCount)
  Object.assign(ws.getCell(2, 1), sheetSubtitleStyle())
  ws.getCell(2, 1).value = sheetTitle
  ws.getRow(2).height = 18

  ws.mergeCells(3, 1, 3, colCount)
  Object.assign(ws.getCell(3, 1), metaValueStyle())
  ws.getCell(3, 1).value = `Alcance: ${scopeLabel}`
  ws.getRow(3).height = 16

  ws.mergeCells(4, 1, 4, colCount)
  const c4 = ws.getCell(4, 1)
  Object.assign(c4, metaLabelStyle())
  c4.value = `Generado: ${format(generatedAt, 'dd/MM/yyyy HH:mm', { locale: es })}`
  c4.alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getRow(4).height = 14

  ws.getRow(5).height = 6
  return 6
}

function writeDataTable<T>(
  ws: ExcelJS.Worksheet,
  startRow: number,
  cols: ColDef[],
  rows: T[],
  options?: { footer?: (colIdx: number) => ExcelJS.CellValue; freeze?: boolean },
): number {
  const headerRow = startRow
  ws.getRow(headerRow).height = 18
  cols.forEach((col, ci) => {
    const c = ws.getCell(headerRow, ci + 1)
    c.value = col.header
    Object.assign(c, columnHeaderStyle())
  })

  let rowIdx = headerRow + 1
  rows.forEach((row, ri) => {
    const dr = ws.getRow(rowIdx++)
    dr.height = 14
    const isAlt = ri % 2 === 1
    cols.forEach((col, ci) => {
      const c = dr.getCell(ci + 1)
      c.value = col.get(row)
      Object.assign(c, dataStyle(isAlt))
      if (col.fmt) {
        c.numFmt = col.fmt
        if (col.fmt === FMT.date) c.alignment = { horizontal: 'center', vertical: 'middle' }
        else if (col.fmt === FMT.currency || col.fmt === FMT.currencyNoSign)
          c.alignment = { horizontal: 'right', vertical: 'middle' }
      }
    })
  })

  if (options?.footer) {
    const fr = ws.getRow(rowIdx++)
    fr.height = 16
    cols.forEach((col, ci) => {
      const c = fr.getCell(ci + 1)
      c.value = options.footer!(ci)
      Object.assign(c, ci === 0 ? subtotalStyle() : grandTotalStyle())
      if (ci > 0 && col.fmt) c.numFmt = col.fmt
      if (ci > 0) c.alignment = { horizontal: 'right', vertical: 'middle' }
    })
  }

  if (options?.freeze !== false) {
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow, activeCell: `A${headerRow + 1}` }]
  }
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: cols.length },
  }

  return rowIdx
}

export type CxpReviewExcelConfig = {
  generatedAt: Date
}

export async function buildCxpReviewExcel(
  data: CxpReviewExportData,
  cfg: CxpReviewExcelConfig,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DC Concretos'
  wb.lastModifiedBy = 'Sistema de cuentas por pagar'
  wb.created = cfg.generatedAt
  wb.modified = cfg.generatedAt

  const scope = data.plantScopeLabel

  // ── Resumen por proveedor ───────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor (grupo)', width: 32, get: (r) => (r as typeof data.providerSummaries[0]).supplier_group_name },
      { header: 'RFC', width: 14, get: (r) => (r as typeof data.providerSummaries[0]).supplier_rfc ?? '' },
      { header: 'Entradas sin fact. (mat.)', width: 12, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).orphan_material_count },
      { header: 'Entradas sin fact. (flota)', width: 12, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).orphan_fleet_count },
      { header: 'Exposición sin facturar', width: 16, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).orphan_exposure },
      { header: 'Facturas', width: 10, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).invoice_count },
      { header: 'Abiertas', width: 10, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).invoices_open },
      { header: 'Pagadas', width: 10, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).invoices_paid },
      { header: 'Total facturado', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).invoice_total },
      { header: 'Pagado', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).paid_to_date },
      { header: 'Nota de crédito aplicada', width: 18, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).credit_applied },
      { header: 'Saldo abierto', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).balance_open },
      { header: 'Notas de crédito', width: 12, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).credit_note_count },
      { header: 'Nota de crédito sin aplicar', width: 20, fmt: FMT.currency, get: (r) => (r as typeof data.providerSummaries[0]).credit_unapplied },
      { header: 'Pagos con complemento', width: 14, fmt: FMT.integer, get: (r) => (r as typeof data.providerSummaries[0]).payments_rep_count },
      { header: 'Alerta', width: 36, get: (r) => (r as typeof data.providerSummaries[0]).alert_orphan_and_open },
    ]
    const ws = wb.addWorksheet('Resumen proveedores', {
      pageSetup: { fitToPage: true, orientation: 'landscape' },
    })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Cuentas por pagar — Resumen por proveedor', scope, cfg.generatedAt)
    const sumOrphan = data.providerSummaries.reduce((s, r) => s + r.orphan_exposure, 0)
    const sumBalance = data.providerSummaries.reduce((s, r) => s + r.balance_open, 0)
    writeDataTable(ws, start, cols, data.providerSummaries, {
      footer: (ci) => {
        if (ci === 0) return 'TOTAL'
        if (ci === 4) return sumOrphan
        if (ci === 11) return sumBalance
        return ''
      },
    })
    ws.properties.tabColor = { argb: argb(C.navy) }
  }

  // ── Sin factura ─────────────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Tipo', width: 10, get: (r) => (r as typeof data.orphanRows[0]).kind_label },
      { header: 'Proveedor (grupo)', width: 28, get: (r) => (r as typeof data.orphanRows[0]).supplier_group_name },
      { header: 'Proveedor', width: 22, get: (r) => (r as typeof data.orphanRows[0]).supplier_name },
      { header: 'Planta', width: 18, get: (r) => (r as typeof data.orphanRows[0]).plant_name },
      { header: 'Entrada', width: 14, get: (r) => (r as typeof data.orphanRows[0]).entry_number },
      { header: 'Fecha', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.orphanRows[0]).entry_date) },
      { header: 'Material', width: 22, get: (r) => (r as typeof data.orphanRows[0]).material_name },
      { header: 'Cantidad', width: 14, get: (r) => (r as typeof data.orphanRows[0]).received_qty },
      { header: 'Costo material', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.orphanRows[0]).material_cost },
      { header: 'Costo flete', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.orphanRows[0]).fleet_cost },
      { header: 'Exposición', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.orphanRows[0]).total_exposure },
      { header: 'Remisión prov.', width: 14, get: (r) => (r as typeof data.orphanRows[0]).supplier_remision },
      { header: 'Guía flete', width: 14, get: (r) => (r as typeof data.orphanRows[0]).fleet_guia },
      { header: 'Vence material', width: 12, fmt: FMT.date, get: (r) => {
        const d = (r as typeof data.orphanRows[0]).ap_due_material
        return d ? excelDate(d) : ''
      }},
      { header: 'Vence flete', width: 12, fmt: FMT.date, get: (r) => {
        const d = (r as typeof data.orphanRows[0]).ap_due_fleet
        return d ? excelDate(d) : ''
      }},
      { header: 'Estado precios', width: 14, get: (r) => (r as typeof data.orphanRows[0]).pricing_status ?? '' },
    ]
    const ws = wb.addWorksheet('Sin factura', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Recepciones sin factura', scope, cfg.generatedAt)
    const sorted = [...data.orphanRows].sort((a, b) =>
      a.supplier_group_name.localeCompare(b.supplier_group_name, 'es') ||
      a.entry_date.localeCompare(b.entry_date),
    )
    const sumExp = sorted.reduce((s, r) => s + r.total_exposure, 0)
    writeDataTable(ws, start, cols, sorted, {
      footer: (ci) => (ci === 0 ? 'TOTAL' : ci === 10 ? sumExp : ''),
    })
    ws.properties.tabColor = { argb: argb(C.additionalRowTint) }
  }

  // ── Facturas ────────────────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 28, get: (r) => (r as typeof data.invoices[0]).supplier_group_name },
      { header: 'Planta', width: 16, get: (r) => (r as typeof data.invoices[0]).plant_name },
      { header: 'Factura', width: 16, get: (r) => (r as typeof data.invoices[0]).invoice_number },
      { header: 'Fecha', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.invoices[0]).invoice_date) },
      { header: 'Vencimiento', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.invoices[0]).due_date) },
      { header: 'Origen', width: 22, get: (r) => (r as typeof data.invoices[0]).source_label },
      { header: 'Estado', width: 14, get: (r) => (r as typeof data.invoices[0]).status_label },
      { header: 'Subtotal', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).subtotal },
      { header: 'Descuento', width: 12, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).discount_amount },
      { header: 'IVA', width: 12, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).tax },
      { header: 'Total', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).total },
      { header: 'Pagado', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).paid_to_date },
      { header: 'Nota de crédito aplicada', width: 18, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).credit_applied_total },
      { header: 'Saldo', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.invoices[0]).balance },
      { header: 'Líneas', width: 8, fmt: FMT.integer, get: (r) => (r as typeof data.invoices[0]).line_count },
      { header: 'Líneas con recepción', width: 12, fmt: FMT.integer, get: (r) => (r as typeof data.invoices[0]).lines_with_entry },
      { header: 'Líneas sin recepción', width: 12, fmt: FMT.integer, get: (r) => (r as typeof data.invoices[0]).lines_without_entry },
      { header: 'Pagos', width: 8, fmt: FMT.integer, get: (r) => (r as typeof data.invoices[0]).payment_count },
      { header: 'Pagos con complemento', width: 14, fmt: FMT.integer, get: (r) => (r as typeof data.invoices[0]).payments_with_rep },
      { header: 'Folio fiscal', width: 38, get: (r) => (r as typeof data.invoices[0]).cfdi_uuid ?? '' },
      { header: 'Método de pago (CFDI)', width: 28, get: (r) => (r as typeof data.invoices[0]).cfdi_metodo_pago },
      { header: 'Estado en SAT', width: 14, get: (r) => (r as typeof data.invoices[0]).cfdi_estado_sat },
    ]
    const ws = wb.addWorksheet('Facturas', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Facturas de proveedor', scope, cfg.generatedAt)
    const sorted = [...data.invoices].sort((a, b) =>
      a.supplier_group_name.localeCompare(b.supplier_group_name, 'es') ||
      b.invoice_date.localeCompare(a.invoice_date),
    )
    writeDataTable(ws, start, cols, sorted, {
      footer: (ci) => {
        if (ci === 0) return 'TOTAL'
        if (ci === 10) return sorted.reduce((s, r) => s + r.total, 0)
        if (ci === 13) return sorted.reduce((s, r) => s + r.balance, 0)
        return ''
      },
    })
    ws.properties.tabColor = { argb: argb(C.green) }
  }

  // ── Líneas de factura ───────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 24, get: (r) => (r as typeof data.invoiceLines[0]).supplier_group_name },
      { header: 'Factura', width: 14, get: (r) => (r as typeof data.invoiceLines[0]).invoice_number },
      { header: 'Planta', width: 14, get: (r) => (r as typeof data.invoiceLines[0]).plant_name },
      { header: 'Categoría', width: 14, get: (r) => (r as typeof data.invoiceLines[0]).cost_category_label },
      { header: 'Vinculación', width: 18, get: (r) => (r as typeof data.invoiceLines[0]).linkage },
      { header: 'Entrada', width: 12, get: (r) => (r as typeof data.invoiceLines[0]).entry_number ?? '' },
      { header: 'Fecha entrada', width: 12, fmt: FMT.date, get: (r) => {
        const d = (r as typeof data.invoiceLines[0]).entry_date
        return d ? excelDate(d) : ''
      }},
      { header: 'Material', width: 20, get: (r) => (r as typeof data.invoiceLines[0]).material_name ?? '' },
      { header: 'Motivo manual', width: 18, get: (r) => (r as typeof data.invoiceLines[0]).manual_reason ?? '' },
      { header: 'Descripción', width: 24, get: (r) => (r as typeof data.invoiceLines[0]).description ?? '' },
      { header: 'Cant.', width: 10, fmt: FMT.currencyNoSign, get: (r) => (r as typeof data.invoiceLines[0]).qty ?? '' },
      { header: 'P. unit.', width: 12, fmt: FMT.currency, get: (r) => (r as typeof data.invoiceLines[0]).unit_price ?? '' },
      { header: 'Importe', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.invoiceLines[0]).amount },
    ]
    const ws = wb.addWorksheet('Líneas factura', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Detalle de líneas de factura', scope, cfg.generatedAt)
    writeDataTable(ws, start, cols, data.invoiceLines)
    ws.properties.tabColor = { argb: argb(C.borderMedium) }
  }

  // ── Pagos ───────────────────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 24, get: (r) => (r as typeof data.payments[0]).supplier_group_name },
      { header: 'Factura', width: 14, get: (r) => (r as typeof data.payments[0]).invoice_number },
      { header: 'Estado factura', width: 14, get: (r) => (r as typeof data.payments[0]).invoice_status_label },
      { header: 'Planta', width: 14, get: (r) => (r as typeof data.payments[0]).plant_name },
      { header: 'Fecha pago', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.payments[0]).payment_date) },
      { header: 'Monto', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.payments[0]).amount },
      { header: 'Forma de pago', width: 28, get: (r) => (r as typeof data.payments[0]).method_label },
      { header: 'Referencia', width: 18, get: (r) => (r as typeof data.payments[0]).reference ?? '' },
      { header: 'Origen del registro', width: 22, get: (r) => (r as typeof data.payments[0]).source },
      { header: 'Tiene complemento', width: 14, get: (r) => (r as typeof data.payments[0]).complemento_label },
      { header: 'Folio complemento de pago', width: 38, get: (r) => (r as typeof data.payments[0]).cfdi_rep_uuid ?? '' },
      { header: 'Folio factura pagada', width: 38, get: (r) => (r as typeof data.payments[0]).cfdi_docto_uuid ?? '' },
      { header: 'Parcialidad', width: 10, fmt: FMT.integer, get: (r) => (r as typeof data.payments[0]).cfdi_num_parcialidad ?? '' },
    ]
    const ws = wb.addWorksheet('Pagos', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Pagos registrados', scope, cfg.generatedAt)
    const sorted = [...data.payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    writeDataTable(ws, start, cols, sorted, {
      footer: (ci) => (ci === 0 ? 'TOTAL' : ci === 5 ? sorted.reduce((s, r) => s + r.amount, 0) : ''),
    })
    ws.properties.tabColor = { argb: argb(C.pumpingRowTint) }
  }

  // ── Complementos (subset) ───────────────────────────────────────────────
  {
    const repPayments = data.payments.filter((p) => p.has_complemento)
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 24, get: (r) => (r as typeof data.payments[0]).supplier_group_name },
      { header: 'Factura', width: 14, get: (r) => (r as typeof data.payments[0]).invoice_number },
      { header: 'Fecha pago', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.payments[0]).payment_date) },
      { header: 'Monto', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.payments[0]).amount },
      { header: 'Folio complemento de pago', width: 38, get: (r) => (r as typeof data.payments[0]).cfdi_rep_uuid ?? '' },
      { header: 'Folio factura relacionada', width: 38, get: (r) => (r as typeof data.payments[0]).cfdi_docto_uuid ?? '' },
      { header: 'Parcialidad', width: 10, fmt: FMT.integer, get: (r) => (r as typeof data.payments[0]).cfdi_num_parcialidad ?? '' },
      { header: 'Forma de pago', width: 28, get: (r) => (r as typeof data.payments[0]).method_label },
    ]
    const ws = wb.addWorksheet('Complementos pago', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(
      ws,
      cols.length,
      'Complementos de pago aplicados en el sistema',
      scope,
      cfg.generatedAt,
    )
    writeDataTable(ws, start, cols, repPayments)
    ws.properties.tabColor = { argb: argb(C.navyDark) }
  }

  // ── Notas de crédito ────────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 28, get: (r) => (r as typeof data.creditNotes[0]).supplier_group_name },
      { header: 'Planta', width: 16, get: (r) => (r as typeof data.creditNotes[0]).plant_name },
      { header: 'Nota', width: 16, get: (r) => (r as typeof data.creditNotes[0]).credit_number },
      { header: 'Fecha', width: 12, fmt: FMT.date, get: (r) => excelDate((r as typeof data.creditNotes[0]).credit_date) },
      { header: 'Motivo', width: 18, get: (r) => (r as typeof data.creditNotes[0]).reason },
      { header: 'Subtotal', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.creditNotes[0]).amount },
      { header: 'IVA', width: 12, fmt: FMT.currency, get: (r) => (r as typeof data.creditNotes[0]).tax_amount },
      { header: 'Total', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.creditNotes[0]).total },
      { header: 'Aplicado', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.creditNotes[0]).allocated_total },
      { header: 'Sin aplicar', width: 14, fmt: FMT.currency, get: (r) => (r as typeof data.creditNotes[0]).unapplied_total },
      { header: 'Estado', width: 14, get: (r) => (r as typeof data.creditNotes[0]).status_label },
      { header: 'Facturas', width: 32, get: (r) => (r as typeof data.creditNotes[0]).invoices_touched },
      { header: 'Folio fiscal', width: 38, get: (r) => (r as typeof data.creditNotes[0]).cfdi_uuid ?? '' },
      { header: 'Estado en SAT', width: 14, get: (r) => (r as typeof data.creditNotes[0]).cfdi_estado_sat },
    ]
    const ws = wb.addWorksheet('Notas de crédito', { pageSetup: { fitToPage: true, orientation: 'landscape' } })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(ws, cols.length, 'Notas de crédito', scope, cfg.generatedAt)
    writeDataTable(ws, start, cols, data.creditNotes)
    ws.properties.tabColor = { argb: argb(C.additionalRowText) }
  }

  // ── NC por factura ──────────────────────────────────────────────────────
  {
    const cols: ColDef[] = [
      { header: 'Proveedor', width: 24, get: (r) => (r as typeof data.creditNoteAllocations[0]).supplier_group_name },
      { header: 'Nota', width: 14, get: (r) => (r as typeof data.creditNoteAllocations[0]).credit_number },
      { header: 'Factura', width: 14, get: (r) => (r as typeof data.creditNoteAllocations[0]).invoice_number },
      { header: 'Estado factura', width: 14, get: (r) => (r as typeof data.creditNoteAllocations[0]).invoice_status_label },
      { header: 'Subtotal nota de crédito', width: 18, fmt: FMT.currency, get: (r) => (r as typeof data.creditNoteAllocations[0]).allocated_subtotal },
      { header: 'IVA nota de crédito', width: 16, fmt: FMT.currency, get: (r) => (r as typeof data.creditNoteAllocations[0]).allocated_tax },
      { header: 'Total nota de crédito', width: 18, fmt: FMT.currency, get: (r) => (r as typeof data.creditNoteAllocations[0]).allocated_total },
    ]
    const ws = wb.addWorksheet('Notas crédito por factura', {
      pageSetup: { fitToPage: true, orientation: 'landscape' },
    })
    ws.columns = cols.map((c) => ({ width: c.width }))
    const start = applySheetBanner(
      ws,
      cols.length,
      'Aplicación de notas de crédito por factura',
      scope,
      cfg.generatedAt,
    )
    writeDataTable(ws, start, cols, data.creditNoteAllocations)
  }

  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
