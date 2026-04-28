/**
 * ExcelJS workbook for RH weekly remisiones — same branding rhythm as
 * `deliveryReceiptExcel` (DC_DOCUMENT_THEME, frozen header, autofilter, zebra + bombeo tint).
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { DC_DOCUMENT_THEME as C, DC_NUMBER_FORMATS as FMT, getDocumentContact } from '@/lib/reports/branding';
import type { HrWeeklyRemisionRow } from '@/services/hrWeeklyRemisionesService';

function argb(hex: string, alpha = 'FF'): string {
  return alpha + hex.replace('#', '');
}

function titleStyle(wb: ExcelJS.Workbook): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: false },
  };
}

function metaValueStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, color: { argb: argb(C.textPrimary) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } },
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
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
    alignment: { vertical: 'top', wrapText: true },
    border: {
      bottom: { style: 'hair', color: { argb: argb(C.borderLight) } },
    },
  };
}

function pumpingRowStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 9, name: 'Calibri', italic: true, color: { argb: argb(C.navy) } },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(C.pumpingRowTint) },
    },
    alignment: { vertical: 'top', wrapText: true },
    border: {
      bottom: { style: 'hair', color: { argb: argb(C.borderLight) } },
    },
  };
}

function totalStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, name: 'Calibri', color: { argb: argb(C.white) } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'right' },
  };
}

function isPumpingRow(r: HrWeeklyRemisionRow): boolean {
  return String(r.tipo_remision ?? '').toUpperCase() === 'BOMBEO';
}

const COL_COUNT = 15;

const HEADERS = [
  'Fecha',
  'Hora carga',
  'Tipo',
  'Remisión',
  'Conductor',
  'Unidad',
  'Volumen (m³)',
  'Cliente',
  'Obra',
  'Planta',
  'Prod. cruzada',
  'Planta facturación',
  'Reasignación (Arkik)',
  'Motivo cancelación',
  'Comentarios pedido',
] as const;

export type HrWeeklyExcelOptions = {
  startDate: string;
  endDate: string;
  generatedAt: Date;
};

export async function buildHrWeeklyRemisionesExcel(
  rows: HrWeeklyRemisionRow[],
  opts: HrWeeklyExcelOptions,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DC Concretos';
  wb.lastModifiedBy = 'RH — Reporte semanal';
  wb.created = opts.generatedAt;
  wb.modified = opts.generatedAt;

  const ws = wb.addWorksheet('Remisiones', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

  ws.columns = Array.from({ length: COL_COUNT }, (_, i) => ({
    width: [12, 10, 11, 12, 22, 14, 11, 28, 26, 14, 12, 18, 36, 22, 32][i] ?? 14,
  }));

  const contact = getDocumentContact();
  const periodo = `${opts.startDate} — ${opts.endDate}`;

  ws.mergeCells(1, 1, 1, COL_COUNT);
  const c1 = ws.getCell(1, 1);
  c1.value = contact.companyLine;
  Object.assign(c1, titleStyle(wb));
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, COL_COUNT);
  const c2 = ws.getCell(2, 1);
  c2.value = 'RH — Reporte semanal de remisiones (concreto y bombeo)';
  c2.font = { bold: true, size: 11, name: 'Calibri', color: { argb: argb(C.navy) } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } };
  c2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 18;

  const meta: [string, string][] = [
    ['Período', periodo],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
    ['Registros', String(rows.length)],
  ];
  meta.forEach(([label, val], i) => {
    const r = 3 + i;
    ws.mergeCells(r, 1, r, COL_COUNT);
    const cell = ws.getCell(r, 1);
    cell.value = `${label}: ${val}`;
    Object.assign(cell, metaValueStyle());
    ws.getRow(r).height = 14;
  });

  ws.getRow(6).height = 4;

  const headerRow = ws.getRow(7);
  headerRow.height = 28;
  HEADERS.forEach((h, ci) => {
    const cell = headerRow.getCell(ci + 1);
    cell.value = h;
    Object.assign(cell, columnHeaderStyle());
  });

  const sorted = [...rows].sort((a, b) => {
    const fd = (a.fecha ?? '').localeCompare(b.fecha ?? '');
    if (fd !== 0) return fd;
    return String(a.remision_number ?? '').localeCompare(String(b.remision_number ?? ''));
  });

  let volSum = 0;
  sorted.forEach((r, ri) => {
    const row = ws.getRow(8 + ri);
    row.height = 16;
    const pumping = isPumpingRow(r);
    const style = pumping ? pumpingRowStyle() : dataStyle(ri % 2 === 1);
    volSum += Number(r.volumen_fabricado) || 0;

    const hora = r.hora_carga ? String(r.hora_carga).slice(0, 8) : '';
    const vals: ExcelJS.CellValue[] = [
      r.fecha ? new Date(`${r.fecha}T12:00:00`) : '',
      hora,
      r.tipo_remision ?? '',
      r.remision_number ?? '',
      r.conductor ?? '',
      r.unidad ?? '',
      Number(r.volumen_fabricado) || 0,
      r.order?.client?.business_name ?? '',
      r.order?.construction_site ?? '',
      r.plant?.code ?? r.plant?.name ?? '',
      r.is_production_record ? 'Sí' : 'No',
      r.billing_plant?.name ?? r.cross_plant_billing_plant_id ?? '',
      r.reassignment_note ?? '',
      r.cancelled_reason ?? '',
      r.order?.comentarios_internos ?? '',
    ];

    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      Object.assign(cell, style);
      if (ci === 0) {
        cell.numFmt = FMT.date;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (ci === 6) {
        cell.numFmt = FMT.currencyNoSign;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.numFmt = '@';
      }
    });
  });

  const totalRowIdx = 8 + sorted.length;
  const tr = ws.getRow(totalRowIdx);
  tr.height = 18;
  for (let ci = 1; ci <= COL_COUNT; ci++) {
    const cell = tr.getCell(ci);
    Object.assign(cell, totalStyle());
    if (ci === 1) {
      cell.value = `TOTAL (${sorted.length} remisiones)`;
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: argb(C.white) } };
    } else if (ci === 7) {
      cell.value = volSum;
      cell.numFmt = FMT.currencyNoSign;
    } else {
      cell.value = '';
    }
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 7, activeCell: 'A8' }];
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: COL_COUNT } };
  ws.properties.tabColor = { argb: argb(C.navy) };

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
