import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DC_DOCUMENT_THEME as C, getDocumentContact } from '@/lib/reports/branding'
import {
  buildClientPortalMuestreosExcelRows,
  buildInternalMuestreosExcelRows,
  type ClientPortalMuestreoExport,
  type ExcelCellValue,
} from '@/lib/quality/muestreosExcelRows'
import type { MuestreoWithRelations } from '@/types/quality'

function argb(hex: string, alpha = 'FF'): string {
  return alpha + hex.replace('#', '')
}

function titleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  }
}

function metaLabelStyle(): Partial<ExcelJS.Style> {
  return {
    font: { italic: true, size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
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
    alignment: { vertical: 'middle', wrapText: false },
    border: { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } },
  }
}

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 48)
}

/** Headers that must stay plain text so Excel does not reinterpret as serial dates. */
const EXCEL_CALENDAR_DATE_HEADERS = new Set([
  'Fecha Muestreo',
  'Fecha muestreo',
  'Fecha ensayo',
  'Fecha prog. ensayo',
])

function assignExcelCellValue(
  cell: ExcelJS.Cell,
  header: string,
  value: ExcelCellValue
): void {
  const text = value == null ? '' : String(value)
  if (
    EXCEL_CALENDAR_DATE_HEADERS.has(header) &&
    text &&
    text !== 'N/A' &&
    text !== '—'
  ) {
    cell.value = text
    cell.numFmt = '@'
    return
  }
  cell.value = value
}

async function buildBrandedDataSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  metaLines: string[],
  dataRows: Record<string, ExcelCellValue>[]
): Promise<void> {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 5 }],
  })
  const contact = getDocumentContact()
  const colCount = dataRows.length > 0 ? Object.keys(dataRows[0]).length : 1
  const lastColLetter =
    colCount <= 26
      ? String.fromCharCode(64 + Math.max(colCount, 1))
      : 'Z'

  ws.mergeCells(`A1:${lastColLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = title
  titleCell.style = titleStyle()
  ws.getRow(1).height = 24

  ws.mergeCells(`A2:${lastColLetter}2`)
  ws.getCell('A2').value = contact.companyLine
  ws.getCell('A2').style = metaLabelStyle()

  const metaJoined = [
    ...metaLines,
    `Generado: ${format(new Date(), "d MMM yyyy HH:mm", { locale: es })}`,
    contact.phone ? `Tel. ${contact.phone}` : null,
    contact.email,
  ]
    .filter(Boolean)
    .join('  |  ')

  ws.mergeCells(`A3:${lastColLetter}3`)
  ws.getCell('A3').value = metaJoined
  ws.getCell('A3').style = metaLabelStyle()
  ws.getRow(3).height = 18

  if (dataRows.length === 0) {
    ws.getCell('A5').value = 'Sin registros para exportar'
    return
  }

  const headers = Object.keys(dataRows[0])
  const headerRow = ws.getRow(5)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.style = columnHeaderStyle()
  })
  headerRow.height = 28

  dataRows.forEach((row, rowIdx) => {
    const r = ws.addRow(headers.map((h) => row[h] ?? ''))
    r.height = 18
    r.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) {
        assignExcelCellValue(cell, header, row[header] ?? '')
      }
      cell.style = {
        ...dataStyle(rowIdx % 2 === 1),
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
      }
    })
  })

  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1)
    const sample = String(dataRows[0]?.[h] ?? h)
    col.width = Math.min(36, Math.max(10, Math.max(h.length, sample.length) + 2))
  })

  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + dataRows.length, column: headers.length },
  }
}

export interface ClientPortalMuestreosExcelConfig {
  clientName: string
  periodLabel?: string
  muestreos: ClientPortalMuestreoExport[]
}

export async function downloadClientPortalMuestreosExcel(
  config: ClientPortalMuestreosExcelConfig
): Promise<void> {
  const rows = buildClientPortalMuestreosExcelRows(config.muestreos)
  const wb = new ExcelJS.Workbook()
  wb.creator = getDocumentContact().companyLine
  wb.created = new Date()

  await buildBrandedDataSheet(
    wb,
    'Muestreos',
    'Reporte de muestreos — Portal del cliente',
    [
      `Cliente: ${config.clientName}`,
      config.periodLabel ? `Periodo: ${config.periodLabel}` : '',
      `Registros: ${rows.length}`,
    ].filter(Boolean),
    rows
  )

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const safeName = sanitizeFilenamePart(config.clientName)
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  triggerBrowserDownload(buffer, `Muestreos_${safeName}_${dateStr}.xlsx`)
}

export interface InternalMuestreosExcelConfig {
  muestreos: MuestreoWithRelations[]
  filterSummary: string
  plantLabel?: string
}

export async function downloadInternalMuestreosExcel(
  config: InternalMuestreosExcelConfig
): Promise<void> {
  const rows = buildInternalMuestreosExcelRows(config.muestreos)
  const wb = new ExcelJS.Workbook()
  wb.creator = getDocumentContact().companyLine
  wb.created = new Date()

  const meta = [
    config.plantLabel ? `Alcance: ${config.plantLabel}` : '',
    config.filterSummary,
    `Muestreos exportados: ${config.muestreos.length}`,
    `Filas en detalle: ${rows.length}`,
  ].filter(Boolean)

  await buildBrandedDataSheet(
    wb,
    'Muestreos',
    'Reporte de muestreos — Control de calidad',
    meta,
    rows
  )

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  triggerBrowserDownload(buffer, `Muestreos_Calidad_${dateStr}.xlsx`)
}
