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
import type { ReportRemisionData, ReportSummary, ReportColumn, AdditionalProductLine } from '@/types/pdf-reports';
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

/** Pumping / auxiliary-service row variant: navy italic on a subtle blue tint.
 *  Same weight as dataStyle so the table's visual rhythm is preserved. */
function pumpingRowStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, name: 'Calibri', italic: true, color: { argb: argb(C.navy) } },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(C.pumpingRowTint) },
    },
    alignment: { vertical: 'middle' },
    border: {
      bottom: { style: 'hair', color: { argb: argb(C.borderLight) } },
    },
  };
}

/** Additional-product pseudo-row variant: amber-900 italic on amber-100 tint. */
function additionalRowStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, name: 'Calibri', italic: true, color: { argb: argb(C.additionalRowText) } },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(C.additionalRowTint) },
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

/**
 * Returns true when a row represents a pumping / auxiliary service (BOMBEO,
 * VACÍO DE OLLA). Does NOT match ADICIONAL pseudo-rows — use isAdditionalRow().
 */
function isPumpingRow(r: ReportRemisionData): boolean {
  const t = String(r.tipo_remision ?? '').toUpperCase();
  return t === 'BOMBEO' || t === 'VACÍO DE OLLA' || t === 'VACIO DE OLLA';
}

/** Returns true when a row is a synthetic additional-product pseudo-row. */
function isAdditionalRow(r: ReportRemisionData): boolean {
  return String(r.tipo_remision ?? '').toUpperCase() === 'ADICIONAL';
}

/**
 * FIFO pumping cost allocation per concrete remision.
 *
 * For each order that has pumping remisiones:
 *   - Compute total pumped volume (sum of pumping row volumen_fabricado).
 *   - Compute blended pumping rate = total pumping line_total / total pumped vol.
 *   - Sort concrete rows by fecha ascending (FIFO).
 *   - Walk through concrete rows allocating min(row_vol, remaining_pumped) × rate.
 *   - Rows beyond the pumped volume receive no allocation (key absent from map).
 *
 * Returns Map keyed by `${order_id}:${remision_id}` → allocated cost (number).
 * Exported so page.tsx can reuse without duplicating the logic.
 */
export function computeFIFOPumpingAllocation(
  data: ReportRemisionData[],
): Map<string, number> {
  const result = new Map<string, number>();

  // Aggregate pumping totals per order
  const pumpingByOrder = new Map<string, { vol: number; cost: number }>();
  const concreteByOrder = new Map<string, ReportRemisionData[]>();

  for (const r of data) {
    const key = String(r.order_id ?? '');
    if (!key) continue;
    if (isPumpingRow(r)) {
      const p = pumpingByOrder.get(key) ?? { vol: 0, cost: 0 };
      p.vol += r.volumen_fabricado ?? 0;
      p.cost += r.line_total ?? 0;
      pumpingByOrder.set(key, p);
    } else if (!isAdditionalRow(r)) {
      // Real concrete remision
      if (!concreteByOrder.has(key)) concreteByOrder.set(key, []);
      concreteByOrder.get(key)!.push(r);
    }
  }

  pumpingByOrder.forEach((pump, orderId) => {
    if (pump.vol <= 0 || pump.cost <= 0) return;
    const concretes = concreteByOrder.get(orderId);
    if (!concretes || !concretes.length) return;

    const rate = pump.cost / pump.vol; // $/m³ blended rate
    // FIFO: sort ascending by date so earlier deliveries consume pumping first
    const sorted = [...concretes].sort((a, b) =>
      (a.fecha ?? '').localeCompare(b.fecha ?? ''),
    );

    let remaining = pump.vol;
    for (const row of sorted) {
      if (remaining <= 0) break;
      const vol = row.volumen_fabricado ?? 0;
      const covered = Math.min(vol, remaining);
      remaining -= covered;
      result.set(`${orderId}:${String(row.id ?? '')}`, covered * rate);
    }
  });

  return result;
}

interface AdditionalOrderInfo {
  /** Sum of unit_price for all PER_M3 additionals (shown on concrete rows). */
  total_per_m3: number;
  /** Label strings like "+$150.00/m³ (FIBRA_PP_600)" for each PER_M3 entry. */
  labels: string[];
  /** All additional-product lines (for Resumen breakdown). */
  all: AdditionalProductLine[];
}

/** Build a map: order_id → per-m³ addon info for concrete-row annotation. */
function computeAdditionalsByOrderId(data: ReportRemisionData[]): Map<string, AdditionalOrderInfo> {
  const m = new Map<string, AdditionalOrderInfo>();
  const fmtCurr = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  for (const r of data) {
    const key = String(r.order_id ?? '');
    if (!key || m.has(key)) continue;
    const addl = r.order?.additional_products ?? [];
    if (!addl.length) continue;
    const perM3 = addl.filter((a) => a.billing_type === 'PER_M3');
    const total_per_m3 = perM3.reduce((s, a) => s + a.unit_price, 0);
    // Label shows only the amount — code is internal noise to clients
    const labels = perM3.length > 0 ? [`+${fmtCurr(total_per_m3)}/m³`] : [];
    m.set(key, { total_per_m3, labels, all: addl });
  }
  return m;
}

/**
 * Synthesises one amber pseudo-row per additional-product line in each order.
 * These are merged into the Remisiones data so the Excel grand total naturally
 * picks up their `line_total`. Exported so page.tsx can reuse for the preview.
 */
export function buildAdditionalProductPseudoRows(
  data: ReportRemisionData[],
): ReportRemisionData[] {
  const pseudo: ReportRemisionData[] = [];
  const seenOrders = new Set<string>();

  for (const r of data) {
    const key = String(r.order_id ?? '');
    if (!key || seenOrders.has(key)) continue;
    const addl = r.order?.additional_products ?? [];
    if (!addl.length) continue;
    seenOrders.add(key);

    for (let i = 0; i < addl.length; i++) {
      const ap = addl[i];
      pseudo.push({
        // Use a synthetic id so React / ExcelJS can distinguish rows
        id: `ap:${key}:${i}`,
        remision_number: ap.code,
        fecha: r.fecha,
        order_id: r.order_id,
        // 0 volume so m³ totals at footer stay accurate
        volumen_fabricado: 0,
        tipo_remision: 'ADICIONAL',
        master_code: ap.name,
        conductor: undefined,
        unidad: undefined,
        recipe: undefined,
        order: r.order,
        client: r.client,
        plant_info: r.plant_info,
        unit_price: ap.unit_price,
        line_total: ap.total_price,
        // Preserve IVA parity: use same vatRatePct as the anchor concrete row
        vat_amount: r.order?.requires_invoice
          ? ap.total_price * ((r.plant_info?.vat_percentage ?? 16) / 100)
          : 0,
        final_total: r.order?.requires_invoice
          ? ap.total_price * (1 + (r.plant_info?.vat_percentage ?? 16) / 100)
          : ap.total_price,
      } as ReportRemisionData);
    }
  }
  return pseudo;
}

function cellValue(
  item: ReportRemisionData,
  col: ReportColumn,
  rowIdx: number,
  fifoAllocationMap: Map<string, number>,
  additionalsByOrderId: Map<string, AdditionalOrderInfo>,
): string | number | Date {
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
    // Arkik/dosificadora code — matches the physical remision the client holds.
    case 'recipe_code_arkik': return item.recipe?.recipe_code ?? '';
    case 'volumen_fabricado': return item.volumen_fabricado ?? 0;
    case 'unit_price': {
      const base = item.unit_price ?? 0;
      if (!isAdditionalRow(item) && !isPumpingRow(item)) {
        const info = additionalsByOrderId.get(String(item.order_id ?? ''));
        if (info && info.total_per_m3 > 0) return base + info.total_per_m3;
      }
      return base;
    }
    case 'line_total': return item.line_total ?? 0;
    case 'vat_amount': return item.vat_amount ?? 0;
    case 'final_total': return item.final_total ?? 0;
    case 'conductor': return item.conductor ?? '';
    case 'strength_fc': return item.recipe?.strength_fc ?? '';
    case 'placement_type': return item.recipe?.placement_type ?? '';
    case 'slump': return item.recipe?.slump ?? '';
    case 'requires_invoice': return item.order?.requires_invoice ? 'Sí' : 'No';
    case 'client_rfc': return item.client?.rfc ?? '';
    case 'special_requirements': return item.order?.special_requirements ?? '';
    case 'comentarios_internos': return item.order?.comentarios_internos ?? '';
    case 'arkik_reassignment': return item.arkik_reassignment_note ?? '';
    case 'order_status': return item.order?.order_status ?? '';
    case 'tipo_remision': return item.tipo_remision ?? '';
    case 'recipe_notes': return item.recipe?.notes ?? '';
    case 'age_days': return item.recipe?.age_days ?? '';
    case 'serv_bombeo': {
      // Pumping row itself: emit its own line_total so the row-loop can
      // apply currency formatting and bold the actual service charge.
      if (isPumpingRow(item)) return item.line_total ?? 0;
      // Additional pseudo-rows don't participate in the bombeo column.
      if (isAdditionalRow(item)) return '';
      // Concrete row: show the FIFO-allocated pumping cost for this remision.
      // Rows that fall outside the pumped volume remain empty.
      const mapKey = `${String(item.order_id ?? '')}:${String(item.id ?? '')}`;
      const allocated = fifoAllocationMap.get(mapKey);
      return allocated != null && allocated > 0 ? allocated : '';
    }
    case 'adicional_m3': {
      // Additional pseudo-row: empty (the row IS the additional; value in line_total).
      if (isAdditionalRow(item) || isPumpingRow(item)) return '';
      // Concrete row: show per-m³ annotation for PER_M3 additionals on this order.
      const info = additionalsByOrderId.get(String(item.order_id ?? ''));
      if (!info || info.total_per_m3 === 0) return '';
      return info.labels.length === 1 ? info.labels[0] : info.labels.join(' + ');
    }
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
  // 1. Pre-compute lookup maps from the original service data.
  const fifoAllocationMap = computeFIFOPumpingAllocation(data);
  const additionalsByOrderId = computeAdditionalsByOrderId(data);

  // 2. Merge additional-product pseudo-rows and sort:
  //    concrete first → pumping (blue) → additional (amber), then by date within tier.
  const pseudoRows = buildAdditionalProductPseudoRows(data);
  const allRows = [...data, ...pseudoRows].sort((a, b) => {
    // Primary: order
    const oa = a.order?.order_number ?? '';
    const ob = b.order?.order_number ?? '';
    const orderCmp = oa.localeCompare(ob, 'es-MX');
    if (orderCmp !== 0) return orderCmp;
    // Secondary: row type rank (CONCRETO=0, pumping=1, ADICIONAL=2)
    const rankA = isAdditionalRow(a) ? 2 : isPumpingRow(a) ? 1 : 0;
    const rankB = isAdditionalRow(b) ? 2 : isPumpingRow(b) ? 1 : 0;
    if (rankA !== rankB) return rankA - rankB;
    // Tertiary: date
    return (a.fecha ?? '').localeCompare(b.fecha ?? '');
  });

  allRows.forEach((item, ri) => {
    const dataRow = ws.getRow(9 + ri);
    dataRow.height = 14;
    const additional = isAdditionalRow(item);
    const pumping = isPumpingRow(item);
    const isAlt = ri % 2 === 1;
    const style = additional ? additionalRowStyle() : pumping ? pumpingRowStyle() : dataStyle(isAlt);
    cols.forEach((col, ci) => {
      const cell = dataRow.getCell(ci + 1);
      const value = cellValue(item, col, ri, fifoAllocationMap, additionalsByOrderId);
      cell.value = value as ExcelJS.CellValue;
      cell.numFmt = numFmtForCol(col);
      Object.assign(cell, style);
      // Mixed-type columns: apply currency + right-align for numeric values only.
      if (col.id === 'serv_bombeo' || col.id === 'adicional_m3') {
        if (typeof value === 'number') {
          cell.numFmt = FMT.currency;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.numFmt = '@';
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      } else if (col.type === 'currency' || col.format === 'currency' || col.format === 'decimal') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col.type === 'number' || col.format === 'integer') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  const lastDataRow = 8 + allRows.length;

  // ── Grand total row ───────────────────────────────────────────────────────
  const totalRow = ws.getRow(lastDataRow + 1);
  totalRow.height = 18;
  const totalStyle = grandTotalStyle();
  const concreteRows = allRows.filter((r) => !isPumpingRow(r) && !isAdditionalRow(r));
  cols.forEach((col, ci) => {
    const cell = totalRow.getCell(ci + 1);
    Object.assign(cell, totalStyle);
    if (ci === 0) {
      cell.value = `TOTAL (${concreteRows.length} remisiones)`;
      cell.font = { ...totalStyle.font, size: 9 };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    } else if (col.id === 'volumen_fabricado') {
      cell.value = allRows.reduce((s, r) => s + (r.volumen_fabricado ?? 0), 0);
      cell.numFmt = FMT.currencyNoSign;
    } else if (col.id === 'line_total') {
      cell.value = allRows.reduce((s, r) => s + (r.line_total ?? 0), 0);
      cell.numFmt = FMT.currency;
    } else if (col.id === 'vat_amount') {
      cell.value = allRows.reduce((s, r) => s + (r.vat_amount ?? 0), 0);
      cell.numFmt = FMT.currency;
    } else if (col.id === 'final_total') {
      cell.value = allRows.reduce((s, r) => s + (r.final_total ?? 0), 0);
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

  const fmtCurr = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Group data (iterate original service data — pseudo-rows are counted separately)
  type GroupEntry = {
    count: number; vol: number; sub: number; vat: number; total: number;
    pumpingTotal: number; pumpingCount: number;
    additionalLines: AdditionalProductLine[]; additionalTotal: number;
    orderId: string;
  };
  const grouped = new Map<string, GroupEntry>();
  const seenOrdersResumen = new Set<string>();

  for (const r of data) {
    const key =
      cfg.groupBy === 'order'
        ? `Pedido ${r.order?.order_number ?? ''}`
        : cfg.groupBy === 'construction_site'
        ? (r.order?.construction_site ?? 'Sin Obra')
        : 'Total General';
    if (!grouped.has(key)) grouped.set(key, {
      count: 0, vol: 0, sub: 0, vat: 0, total: 0,
      pumpingTotal: 0, pumpingCount: 0,
      additionalLines: [], additionalTotal: 0,
      orderId: String(r.order_id ?? ''),
    });
    const g = grouped.get(key)!;
    g.count += 1;
    g.vol += r.volumen_fabricado ?? 0;
    g.sub += r.line_total ?? 0;
    g.vat += r.vat_amount ?? 0;
    g.total += r.final_total ?? 0;
    if (isPumpingRow(r)) {
      g.pumpingTotal += r.line_total ?? 0;
      g.pumpingCount += 1;
    }
    // Gather additional products once per order (they're order-level)
    const orderId = String(r.order_id ?? '');
    if (!seenOrdersResumen.has(orderId)) {
      const addl = r.order?.additional_products ?? [];
      if (addl.length) {
        seenOrdersResumen.add(orderId);
        g.additionalLines.push(...addl);
        g.additionalTotal += addl.reduce((s, a) => s + a.total_price, 0);
      }
    }
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

    // Pumping caption line
    if (g.pumpingCount > 0) {
      const caption = ws.getRow(rowIdx++);
      caption.height = 13;
      ws.mergeCells(caption.number, 1, caption.number, 6);
      const cc = ws.getCell(caption.number, 1);
      cc.value = `Incluye bombeo: ${fmtCurr(g.pumpingTotal)} (${g.pumpingCount} remisi${g.pumpingCount === 1 ? 'ón' : 'ones'})`;
      cc.font = { italic: true, size: 9, name: 'Calibri', color: { argb: argb(C.navy) } };
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.pumpingRowTint) } };
      cc.alignment = { horizontal: 'right', vertical: 'middle' };
      cc.border = { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } };
    }

    // Additional-products caption + indented breakdown
    if (g.additionalLines.length > 0) {
      // Header line: "Adicionales: $X (N productos)"
      const captionRow = ws.getRow(rowIdx++);
      captionRow.height = 13;
      ws.mergeCells(captionRow.number, 1, captionRow.number, 6);
      const hc = ws.getCell(captionRow.number, 1);
      hc.value = `Adicionales: ${fmtCurr(g.additionalTotal)} (${g.additionalLines.length} producto${g.additionalLines.length === 1 ? '' : 's'})`;
      hc.font = { italic: true, size: 9, name: 'Calibri', color: { argb: argb(C.additionalRowText) } };
      hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.additionalRowTint) } };
      hc.alignment = { horizontal: 'right', vertical: 'middle' };
      hc.border = { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } };

      // Indented detail lines, one per additional product
      for (const ap of g.additionalLines) {
        const detailRow = ws.getRow(rowIdx++);
        detailRow.height = 12;
        ws.mergeCells(detailRow.number, 1, detailRow.number, 6);
        const dc = ws.getCell(detailRow.number, 1);
        let detail: string;
        if (ap.billing_type === 'PER_M3') {
          detail = `    ${ap.name} (${ap.code}) — ${fmtCurr(ap.unit_price)}/m³ = ${fmtCurr(ap.total_price)}`;
        } else if (ap.billing_type === 'PER_ORDER_FIXED') {
          detail = `    ${ap.name} (${ap.code}) — fijo = ${fmtCurr(ap.total_price)}`;
        } else {
          detail = `    ${ap.name} (${ap.code}) — ${ap.volume} × ${fmtCurr(ap.unit_price)} = ${fmtCurr(ap.total_price)}`;
        }
        dc.value = detail;
        dc.font = { italic: true, size: 8, name: 'Calibri', color: { argb: argb(C.additionalRowText) } };
        dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.additionalRowTint) } };
        dc.alignment = { horizontal: 'left', vertical: 'middle' };
        dc.border = { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } };
      }
    }
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
