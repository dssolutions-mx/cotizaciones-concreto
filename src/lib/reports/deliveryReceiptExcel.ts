/**
 * ExcelJS-based delivery receipt export.
 *
 * Sheet 1 "Remisiones" — branded header block + frozen column headers +
 *   zebra rows + per-column number formats + autofilter.
 * Sheet 2 "Resumen" — KPI tiles + per-order subtotals + IVA breakdown.
 *
 * All colors come from DC_DOCUMENT_THEME; no inline color literals.
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { ReportRemisionData, ReportSummary, ReportColumn } from '@/types/pdf-reports';
import {
  DC_DOCUMENT_THEME as C,
  DC_NUMBER_FORMATS as FMT,
  getDocumentContact,
} from '@/lib/reports/branding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryReceiptExcelConfig {
  columns: ReportColumn[];
  reportTitle: string;
  dateRangeLabel: string;
  clientNames: string[];
  plantName?: string;
  vatRatePct?: number;
  generatedAt: Date;
  /** Grouping key for Sheet 2 subtotals */
  groupBy: 'none' | 'order' | 'construction_site';
}

// ---------------------------------------------------------------------------
// Hex helper (ExcelJS wants ARGB without #)
// ---------------------------------------------------------------------------

function argb(hex: string, alpha = 'FF'): string {
  return alpha + hex.replace('#', '');
}

// ---------------------------------------------------------------------------
// Style presets
// ---------------------------------------------------------------------------

function titleStyle(wb: ExcelJS.Workbook): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: false },
  };
}

function metaLabelStyle(): Partial<ExcelJS.Style> {
  return {
    font: { italic: true, size: 9, color: { argb: argb(C.textMuted) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  };
}

function metaValueStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.textPrimary) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  };
}

function columnHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'medium', color: { argb: argb(C.green) } },
    },
  };
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
  };
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
  };
}

function grandTotalStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'right' },
    border: {
      top: { style: 'medium', color: { argb: argb(C.green) } },
    },
  };
}

// ---------------------------------------------------------------------------
// Number format per column
// ---------------------------------------------------------------------------

function numFmtForCol(col: ReportColumn): string {
  if (col.type === 'currency' || col.format === 'currency') return FMT.currency;
  if (col.format === 'decimal') return FMT.currencyNoSign;
  if (col.format === 'integer') return FMT.integer;
  if (col.type === 'date' || col.format === 'date') return FMT.date;
  return '@'; // text
}

// ---------------------------------------------------------------------------
// Cell value extraction
// ---------------------------------------------------------------------------

function cellValue(item: ReportRemisionData, col: ReportColumn, rowIdx: number): string | number | Date {
  switch (col.id) {
    case 'row_number': return rowIdx + 1;
    case 'fecha': {
      try { return new Date(item.fecha + 'T12:00:00'); } catch { return item.fecha; }
    }
    case 'remision_number': return item.remision_number ?? '';
    case 'business_name': return item.client?.business_name ?? '';
    case 'order_number': return item.order?.order_number ?? '';
    case 'construction_site': return item.order?.construction_site ?? '';
    case 'elemento': return item.order?.elemento ?? '';
    case 'unidad_cr':
    case 'unidad': return item.unidad ?? '';
    case 'recipe_code': return item.master_code ?? item.recipe?.recipe_code ?? '';
    case 'volumen_fabricado': return item.volumen_fabricado ?? 0;
    case 'unit_price': return item.unit_price ?? 0;
    case 'line_total': return item.line_total ?? 0;
    case 'vat_amount': return item.vat_amount ?? 0;
    case 'final_total': return item.final_total ?? 0;
    case 'conductor': return item.conductor ?? '';
    case 'strength_fc': return item.recipe?.strength_fc ?? '';
    case 'placement_type': return item.recipe?.placement_type ?? '';
    case 'slump': return item.recipe?.slump ?? '';
    case 'requires_invoice': return item.order?.requires_invoice ? 'Sí' : 'No';
    case 'client_rfc': return item.client?.rfc ?? '';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Sheet 1: Remisiones
// ---------------------------------------------------------------------------

function buildRemisionesSheet(
  ws: ExcelJS.Worksheet,
  data: ReportRemisionData[],
  cfg: DeliveryReceiptExcelConfig,
): void {
  const contact = getDocumentContact();
  const cols = cfg.columns;
  const colCount = cols.length;

  // --- Column widths (approximate from widthPercent → chars) ---------------
  ws.columns = cols.map((c) => ({
    width: Math.max(8, Math.round((parseFloat(c.width ?? '8') || 8) * 1.5)),
    key: c.id,
  }));

  // ── Row 1: Company name (merged across all columns) ──────────────────────
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = contact.companyLine;
  Object.assign(titleCell, titleStyle(ws.workbook as unknown as ExcelJS.Workbook));
  ws.getRow(1).height = 22;

  // ── Row 2: Report title ───────────────────────────────────────────────────
  ws.mergeCells(2, 1, 2, colCount);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = cfg.reportTitle;
  subtitleCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: argb(C.navy) } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 18;

  // ── Rows 3–6: Metadata block ──────────────────────────────────────────────
  const halfCol = Math.max(1, Math.floor(colCount / 2));
  const metaRows: [string, string][] = [
    ['Cliente', cfg.clientNames.join(', ') || '—'],
    ['Período', cfg.dateRangeLabel],
    ['Planta', cfg.plantName ?? '—'],
    ['Generado', format(cfg.generatedAt, 'dd/MM/yyyy HH:mm')],
  ];
  metaRows.forEach(([label, value], i) => {
    const r = 3 + i;
    ws.getRow(r).height = 14;
    // Left half: label
    ws.mergeCells(r, 1, r, halfCol);
    const lc = ws.getCell(r, 1);
    lc.value = `${label}: ${value}`;
    Object.assign(lc, metaValueStyle());
    // Right half: right-align info
    if (i === 0 && cfg.vatRatePct != null) {
      ws.mergeCells(r, halfCol + 1, r, colCount);
      const rc = ws.getCell(r, halfCol + 1);
      rc.value = `IVA: ${cfg.vatRatePct}%`;
      Object.assign(rc, metaLabelStyle());
      rc.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      ws.mergeCells(r, halfCol + 1, r, colCount);
      const rc = ws.getCell(r, halfCol + 1);
      rc.value = `${contact.phone}  ·  ${contact.email}  ·  ${contact.web}`;
      Object.assign(rc, metaLabelStyle());
      rc.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // ── Row 7: blank spacer ───────────────────────────────────────────────────
  ws.getRow(7).height = 4;

  // ── Row 8: Column headers ─────────────────────────────────────────────────
  const headerRow = ws.getRow(8);
  headerRow.height = 24;
  cols.forEach((col, ci) => {
    const cell = headerRow.getCell(ci + 1);
    cell.value = col.label;
    Object.assign(cell, columnHeaderStyle());
  });

  // ── Rows 9+: Data ─────────────────────────────────────────────────────────
  data.forEach((item, ri) => {
    const dataRow = ws.getRow(9 + ri);
    dataRow.height = 14;
    const isAlt = ri % 2 === 1;
    const style = dataStyle(isAlt);
    cols.forEach((col, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = cellValue(item, col, ri) as ExcelJS.CellValue;
      cell.numFmt = numFmtForCol(col);
      Object.assign(cell, style);
      if (col.type === 'currency' || col.format === 'currency' || col.format === 'decimal') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.type === 'number' || col.format === 'integer') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  const lastDataRow = 8 + data.length;

  // ── Grand total row ───────────────────────────────────────────────────────
  const totalRow = ws.getRow(lastDataRow + 1);
  totalRow.height = 18;
  const totalStyle = grandTotalStyle();
  cols.forEach((col, ci) => {
    const cell = totalRow.getCell(ci + 1);
    Object.assign(cell, totalStyle);
    if (ci === 0) {
      cell.value = `TOTAL (${data.length} remisiones)`;
      cell.font = { ...totalStyle.font, size: 9 };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    } else if (col.id === 'volumen_fabricado') {
      cell.value = data.reduce((s, r) => s + (r.volumen_fabricado ?? 0), 0);
      cell.numFmt = FMT.currencyNoSign;
    } else if (col.id === 'line_total') {
      cell.value = data.reduce((s, r) => s + (r.line_total ?? 0), 0);
      cell.numFmt = FMT.currency;
    } else if (col.id === 'vat_amount') {
      cell.value = data.reduce((s, r) => s + (r.vat_amount ?? 0), 0);
      cell.numFmt = FMT.currency;
    } else if (col.id === 'final_total') {
      cell.value = data.reduce((s, r) => s + (r.final_total ?? 0), 0);
      cell.numFmt = FMT.currency;
    }
  });

  // ── Freeze panes at row 9 col 1 ──────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, activeCell: 'A9' }];

  // ── Autofilter on header row ──────────────────────────────────────────────
  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: colCount } };

  // ── Tab color ─────────────────────────────────────────────────────────────
  ws.properties.tabColor = { argb: argb(C.navy) };
}

// ---------------------------------------------------------------------------
// Sheet 2: Resumen
// ---------------------------------------------------------------------------

function buildResumenSheet(
  ws: ExcelJS.Worksheet,
  data: ReportRemisionData[],
  summary: ReportSummary,
  cfg: DeliveryReceiptExcelConfig,
): void {
  ws.columns = [
    { width: 30 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ];

  // Title
  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = `${cfg.reportTitle} — Resumen`;
  t.font = { bold: true, size: 13, color: { argb: argb(C.white) }, name: 'Calibri' };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } };
  t.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 22;

  // KPI tiles (row 3)
  ws.getRow(3).height = 18;
  const kpis: [string, string | number, string][] = [
    ['Remisiones', summary.totalRemisiones, '@'],
    ['Volumen (m³)', summary.totalVolume, FMT.currencyNoSign],
    ['Subtotal', summary.totalAmount, FMT.currency],
    ['IVA', summary.totalVAT, FMT.currency],
    ['Total', summary.finalTotal, FMT.currency],
  ];
  kpis.forEach(([label, value, fmt], ci) => {
    const lc = ws.getCell(2, ci + 1);
    lc.value = label;
    Object.assign(lc, metaLabelStyle());
    lc.alignment = { horizontal: 'center', vertical: 'middle' };

    const vc = ws.getCell(3, ci + 1);
    vc.value = value as ExcelJS.CellValue;
    vc.numFmt = fmt as string;
    vc.font = { bold: true, size: 11, name: 'Calibri', color: { argb: argb(ci === 4 ? C.green : C.navy) } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' };
    vc.border = { bottom: { style: 'medium', color: { argb: argb(ci === 4 ? C.green : C.navy) } } };
  });

  // Spacer
  ws.getRow(4).height = 8;

  // Per-group breakdown
  ws.getRow(5).height = 18;
  const groupHeader = ['Grupo', 'Remisiones', 'Volumen m³', 'Subtotal', 'IVA', 'Total'];
  groupHeader.forEach((h, ci) => {
    const c = ws.getCell(5, ci + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });

  // Group data
  const grouped = new Map<string, { count: number; vol: number; sub: number; vat: number; total: number }>();
  for (const r of data) {
    const key =
      cfg.groupBy === 'order'
        ? `Pedido ${r.order?.order_number ?? ''}`
        : cfg.groupBy === 'construction_site'
        ? (r.order?.construction_site ?? 'Sin Obra')
        : 'Total General';
    if (!grouped.has(key)) grouped.set(key, { count: 0, vol: 0, sub: 0, vat: 0, total: 0 });
    const g = grouped.get(key)!;
    g.count += 1;
    g.vol += r.volumen_fabricado ?? 0;
    g.sub += r.line_total ?? 0;
    g.vat += r.vat_amount ?? 0;
    g.total += r.final_total ?? 0;
  }

  let rowIdx = 6;
  grouped.forEach((g, key) => {
    const dr = ws.getRow(rowIdx++);
    dr.height = 14;
    const isAlt = rowIdx % 2 === 0;
    const s = dataStyle(isAlt);
    const vals: (string | number)[] = [key, g.count, g.vol, g.sub, g.vat, g.total];
    const fmts: string[] = ['@', FMT.integer, FMT.currencyNoSign, FMT.currency, FMT.currency, FMT.currency];
    vals.forEach((v, ci) => {
      const c = dr.getCell(ci + 1);
      c.value = v as ExcelJS.CellValue;
      c.numFmt = fmts[ci];
      Object.assign(c, s);
      if (ci > 0) c.alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  // Recipe breakdown
  rowIdx += 1;
  ws.mergeCells(rowIdx, 1, rowIdx, 6);
  const rh = ws.getCell(rowIdx, 1);
  rh.value = 'Desglose por Producto';
  rh.font = { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.navy) } };
  rh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.groupHeaderTint) } };
  ws.getRow(rowIdx).height = 16;
  rowIdx++;

  const recipeHeader = ['Producto', 'Remisiones', 'Volumen m³', 'Subtotal'];
  recipeHeader.forEach((h, ci) => {
    const c = ws.getCell(rowIdx, ci + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });
  rowIdx++;

  Object.entries(summary.groupedByRecipe).forEach(([code, g], ri) => {
    const dr = ws.getRow(rowIdx++);
    dr.height = 13;
    const isAlt = ri % 2 === 1;
    const s = dataStyle(isAlt);
    [[code, '@'], [g.count, FMT.integer], [g.volume, FMT.currencyNoSign], [g.amount, FMT.currency]].forEach(
      ([v, fmt], ci) => {
        const c = dr.getCell(ci + 1);
        c.value = v as ExcelJS.CellValue;
        c.numFmt = fmt as string;
        Object.assign(c, s);
        if (ci > 0) c.alignment = { horizontal: 'right', vertical: 'middle' };
      },
    );
  });

  ws.properties.tabColor = { argb: argb(C.green) };
  ws.views = [{ state: 'normal', activeCell: 'A1' }];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function buildDeliveryReceiptExcel(
  data: ReportRemisionData[],
  summary: ReportSummary,
  cfg: DeliveryReceiptExcelConfig,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DC Concretos';
  wb.lastModifiedBy = 'Sistema de Reportes';
  wb.created = cfg.generatedAt;
  wb.modified = cfg.generatedAt;

  const ws1 = wb.addWorksheet('Remisiones', { pageSetup: { fitToPage: true, orientation: 'landscape' } });
  buildRemisionesSheet(ws1, data, cfg);

  const ws2 = wb.addWorksheet('Resumen');
  buildResumenSheet(ws2, data, summary, cfg);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/** Trigger a browser download of the generated workbook. */
export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
