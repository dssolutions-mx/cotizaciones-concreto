/**
 * ExcelJS workbook for RH weekly remisiones — branded like `deliveryReceiptExcel`,
 * with executive summary + conductor/unit aggregates + compliance + Arkik reassignment views.
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { DC_DOCUMENT_THEME as C, DC_NUMBER_FORMATS as FMT, getDocumentContact } from '@/lib/reports/branding';
import {
  computeComplianceRemisionStats,
  HR_COMPLIANCE_RULE_LABELS,
} from '@/lib/hr/complianceStats';
import { normalizeDriverKey, type HrComplianceFinding } from '@/lib/hr/complianceFromRuns';
import type { HrWeeklyRemisionRow, HrWeeklyResponse } from '@/services/hrWeeklyRemisionesService';

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

function sectionHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: argb(C.navy) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.groupHeaderTint) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
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

function tipoBucket(t: string | null | undefined): 'CONCRETO' | 'BOMBEO' | 'OTRO' {
  const u = String(t ?? '').toUpperCase();
  if (u === 'BOMBEO') return 'BOMBEO';
  if (u === 'CONCRETO') return 'CONCRETO';
  return 'OTRO';
}

type DriverMovement = { concrete: number; bombeo: number; otro: number; reassignTrips: number };
type UnitMovement = DriverMovement;

function aggregateByDriver(rows: HrWeeklyRemisionRow[]): Map<string, DriverMovement> {
  const m = new Map<string, DriverMovement>();
  for (const r of rows) {
    const k = normalizeDriverKey(r.conductor) || 'unknown_driver';
    if (!m.has(k)) m.set(k, { concrete: 0, bombeo: 0, otro: 0, reassignTrips: 0 });
    const e = m.get(k)!;
    const b = tipoBucket(r.tipo_remision);
    if (b === 'CONCRETO') e.concrete++;
    else if (b === 'BOMBEO') e.bombeo++;
    else e.otro++;
    if ((r.reassignment_note ?? '').trim()) e.reassignTrips++;
  }
  return m;
}

function aggregateByUnit(rows: HrWeeklyRemisionRow[]): Map<string, UnitMovement> {
  const m = new Map<string, UnitMovement>();
  for (const r of rows) {
    const k = normalizeDriverKey(r.unidad) || 'unknown_unit';
    if (!m.has(k)) m.set(k, { concrete: 0, bombeo: 0, otro: 0, reassignTrips: 0 });
    const e = m.get(k)!;
    const b = tipoBucket(r.tipo_remision);
    if (b === 'CONCRETO') e.concrete++;
    else if (b === 'BOMBEO') e.bombeo++;
    else e.otro++;
    if ((r.reassignment_note ?? '').trim()) e.reassignTrips++;
  }
  return m;
}

function remisionRowById(rows: HrWeeklyRemisionRow[]): Map<string, HrWeeklyRemisionRow> {
  return new Map(rows.map((r) => [r.id, r]));
}

const DET_COL_COUNT = 15;

const DET_HEADERS = [
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

function applyTopBanner(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  colCount: number,
  sheetSubtitle: string,
  meta: [string, string][],
  rowOffset = 1,
): number {
  const contact = getDocumentContact();
  let r = rowOffset;
  ws.mergeCells(r, 1, r, colCount);
  const c1 = ws.getCell(r, 1);
  c1.value = contact.companyLine;
  Object.assign(c1, titleStyle(wb));
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(r, 1, r, colCount);
  const c2 = ws.getCell(r, 1);
  c2.value = sheetSubtitle;
  c2.font = { bold: true, size: 11, name: 'Calibri', color: { argb: argb(C.navy) } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.surfacePanel) } };
  c2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(r).height = 18;
  r++;

  for (const [label, val] of meta) {
    ws.mergeCells(r, 1, r, colCount);
    const cell = ws.getCell(r, 1);
    cell.value = `${label}: ${val}`;
    Object.assign(cell, metaValueStyle());
    ws.getRow(r).height = 14;
    r++;
  }
  return r;
}

function buildResumenSheet(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, data: HrWeeklyResponse, opts: HrWeeklyExcelOptions) {
  const colCount = 6;
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 18 }, { width: 20 }];

  const periodo = `${opts.startDate} — ${opts.endDate}`;
  let r = applyTopBanner(ws, wb, colCount, 'RH — Resumen ejecutivo', [
    ['Período', periodo],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
  ]);

  ws.getRow(r).height = 6;
  r++;

  const mergeSection = (title: string) => {
    ws.mergeCells(r, 1, r, colCount);
    const c = ws.getCell(r, 1);
    c.value = title;
    Object.assign(c, sectionHeaderStyle());
    ws.getRow(r).height = 18;
    r++;
  };

  mergeSection('Totales del período (filtros aplicados)');
  const kpi: [string, string | number][] = [
    ['Viajes (remisiones)', data.aggregates.trips],
    ['Conductores únicos', data.aggregates.uniqueDrivers],
    ['Unidades únicas', data.aggregates.uniqueTrucks],
    ['Volumen total (m³)', Number(data.aggregates.totalVolume.toFixed(2))],
  ];
  for (const [label, val] of kpi) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true, size: 9, name: 'Calibri' };
    ws.getCell(r, 2).value = val;
    ws.getCell(r, 2).numFmt = typeof val === 'number' && label.includes('Volumen') ? FMT.currencyNoSign : FMT.integer;
    ws.getRow(r).height = 14;
    r++;
  }

  const rows = data.rows;
  const withReassign = rows.filter((x) => (x.reassignment_note ?? '').trim());
  const driversReassign = new Set(withReassign.map((x) => normalizeDriverKey(x.conductor) || 'unknown_driver'));
  const unitsReassign = new Set(withReassign.map((x) => normalizeDriverKey(x.unidad) || 'unknown_unit'));

  r++;
  mergeSection('Arkik — reasignaciones de remisión');
  const arkikKpi: [string, string | number][] = [
    ['Remisiones con registro de reasignación', withReassign.length],
    ['Conductores con ≥1 remisión reasignada', [...driversReassign].filter((k) => k !== 'unknown_driver').length],
    ['Unidades con ≥1 remisión reasignada', [...unitsReassign].filter((k) => k !== 'unknown_unit').length],
  ];
  for (const [label, val] of arkikKpi) {
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { bold: true, size: 9, name: 'Calibri' };
    ws.getCell(r, 2).value = val;
    ws.getCell(r, 2).numFmt = FMT.integer;
    ws.getRow(r).height = 14;
    r++;
  }

  r++;
  mergeSection('Actividad por día');
  const hdr = ws.getRow(r);
  hdr.height = 22;
  ['Fecha', 'Viajes', 'Volumen (m³)'].forEach((h, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = h;
    Object.assign(cell, columnHeaderStyle());
  });
  r++;
  for (let i = 0; i < data.byDay.length; i++) {
    const d = data.byDay[i]!;
    const row = ws.getRow(r);
    row.height = 14;
    const alt = i % 2 === 1;
    const st = dataStyle(alt);
    const dt = new Date(`${d.date}T12:00:00`);
    const c0 = row.getCell(1);
    c0.value = dt;
    c0.numFmt = FMT.date;
    Object.assign(c0, st);
    const c1 = row.getCell(2);
    c1.value = d.trips;
    c1.numFmt = FMT.integer;
    Object.assign(c1, st);
    const c2 = row.getCell(3);
    c2.value = d.volume;
    c2.numFmt = FMT.currencyNoSign;
    Object.assign(c2, st);
    r++;
  }

  const complianceStats = computeComplianceRemisionStats(data.total, data.complianceByRemisionId);
  if (complianceStats) {
    r++;
    mergeSection('Cumplimiento operativo — hallazgos vinculados a remisión');
    const sumRow: [string, string | number][] = [
      ['Remisiones con ≥1 hallazgo', complianceStats.remisionesConHallazgo],
      ['Remisiones sin hallazgo en motor', complianceStats.remisionesSinHallazgo],
      ['% remisiones con hallazgo', `${complianceStats.pctConHallazgo}%`],
    ];
    for (const [label, val] of sumRow) {
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 1).font = { bold: true, size: 9, name: 'Calibri' };
      ws.getCell(r, 2).value = val;
      ws.getRow(r).height = 14;
      r++;
    }
    r++;
    const h2 = ws.getRow(r);
    h2.height = 22;
    ['Regla', 'Remisiones afectadas', '% del total'].forEach((text, ci) => {
      const cell = h2.getCell(ci + 1);
      cell.value = text;
      Object.assign(cell, columnHeaderStyle());
    });
    r++;
    for (let j = 0; j < complianceStats.byRule.length; j++) {
      const br = complianceStats.byRule[j]!;
      const row = ws.getRow(r);
      row.height = 14;
      const st = dataStyle(j % 2 === 1);
      row.getCell(1).value = br.label;
      row.getCell(2).value = br.remisionCount;
      row.getCell(2).numFmt = FMT.integer;
      row.getCell(3).value = `${br.pctOfTotal}%`;
      [1, 2, 3].forEach((ci) => Object.assign(row.getCell(ci), st));
      r++;
    }
  }

  ws.views = [{ state: 'normal', activeCell: 'A1' }];
  ws.properties.tabColor = { argb: argb(C.green) };
}

function buildConductoresSheet(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  data: HrWeeklyResponse,
  opts: HrWeeklyExcelOptions,
  byDriverMovement: Map<string, DriverMovement>,
) {
  const headers = [
    'Conductor',
    'Viajes',
    'Volumen (m³)',
    'Unidades dist.',
    'Plantas',
    'Viajes CONCRETO',
    'Viajes BOMBEO',
    'Otro tipo',
    'Remisiones c/ reasign. Arkik',
    'Válidos (sin incid.)',
    'Incidencias (viajes)',
    'Días c/ incid.',
    'Última incid.',
    'Racha (días)',
  ];
  const colCount = headers.length;
  ws.columns = headers.map((_, i) => ({
    width: [26, 9, 12, 10, 28, 12, 12, 9, 18, 12, 14, 12, 12, 10][i] ?? 12,
  }));

  const periodo = `${opts.startDate} — ${opts.endDate}`;
  let r = applyTopBanner(ws, wb, colCount, 'RH — Por conductor', [
    ['Período', periodo],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
  ]);
  ws.getRow(r).height = 6;
  r++;

  const conductoresHeaderRow = r;
  const hr = ws.getRow(r);
  hr.height = 26;
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });
  r++;

  const sorted = [...data.byDriver].sort((a, b) => b.trips - a.trips || a.conductor.localeCompare(b.conductor));
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i]!;
    const mov = byDriverMovement.get(d.driver_key);
    const row = ws.getRow(r);
    row.height = 16;
    const st = dataStyle(i % 2 === 1);
    const c = d.compliance;
    const vals: ExcelJS.CellValue[] = [
      d.conductor,
      d.trips,
      d.total_volume,
      d.unique_trucks,
      d.plants.join('; '),
      mov?.concrete ?? 0,
      mov?.bombeo ?? 0,
      mov?.otro ?? 0,
      mov?.reassignTrips ?? 0,
      c ? c.validTrips : '—',
      c ? c.flaggedTrips : '—',
      c && c.flaggedDayCount > 0 ? c.flaggedDayCount : '—',
      c?.lastFlaggedDate ?? '—',
      c && c.flaggedDayStreak >= 2 ? c.flaggedDayStreak : '—',
    ];
    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      Object.assign(cell, st);
      if (ci === 1 || ci === 3 || ci === 9 || ci === 10 || ci === 11 || ci === 13) {
        if (typeof v === 'number') {
          cell.numFmt = FMT.integer;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      } else if (ci === 2) {
        cell.numFmt = FMT.currencyNoSign;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (ci === 5 || ci === 6 || ci === 7 || ci === 8) {
        cell.numFmt = FMT.integer;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.numFmt = '@';
      }
    });
    r++;
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: conductoresHeaderRow, activeCell: 'A1' }];
  ws.autoFilter = {
    from: { row: conductoresHeaderRow, column: 1 },
    to: { row: conductoresHeaderRow, column: colCount },
  };
  ws.properties.tabColor = { argb: argb(C.navy) };
}

function buildUnidadesSheet(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  data: HrWeeklyResponse,
  opts: HrWeeklyExcelOptions,
  byUnitMovement: Map<string, UnitMovement>,
) {
  const headers = [
    'Unidad',
    'Viajes',
    'Volumen (m³)',
    'Conductores dist.',
    'Plantas',
    'Viajes CONCRETO',
    'Viajes BOMBEO',
    'Otro tipo',
    'Remisiones c/ reasign. Arkik',
    'Válidos (sin incid.)',
    'Incidencias (viajes)',
    'Días c/ incid.',
    'Última incid.',
    'Racha (días)',
  ];
  const colCount = headers.length;
  ws.columns = headers.map((_, i) => ({
    width: [16, 9, 12, 12, 28, 12, 12, 9, 18, 12, 14, 12, 12, 10][i] ?? 12,
  }));

  const periodo = `${opts.startDate} — ${opts.endDate}`;
  let r = applyTopBanner(ws, wb, colCount, 'RH — Por unidad', [
    ['Período', periodo],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
  ]);
  ws.getRow(r).height = 6;
  r++;

  const unidadesHeaderRow = r;
  const hr = ws.getRow(r);
  hr.height = 26;
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });
  r++;

  const units = data.byUnit ?? [];
  const sorted = [...units].sort((a, b) => b.trips - a.trips || a.unidad.localeCompare(b.unidad));
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i]!;
    const mov = byUnitMovement.get(u.unit_key);
    const row = ws.getRow(r);
    row.height = 16;
    const st = dataStyle(i % 2 === 1);
    const c = u.compliance;
    const vals: ExcelJS.CellValue[] = [
      u.unidad,
      u.trips,
      u.total_volume,
      u.unique_drivers,
      u.plants.join('; '),
      mov?.concrete ?? 0,
      mov?.bombeo ?? 0,
      mov?.otro ?? 0,
      mov?.reassignTrips ?? 0,
      c ? c.validTrips : '—',
      c ? c.flaggedTrips : '—',
      c && c.flaggedDayCount > 0 ? c.flaggedDayCount : '—',
      c?.lastFlaggedDate ?? '—',
      c && c.flaggedDayStreak >= 2 ? c.flaggedDayStreak : '—',
    ];
    vals.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      Object.assign(cell, st);
      if (ci === 1 || ci === 3 || ci === 9 || ci === 10 || ci === 11 || ci === 13) {
        if (typeof v === 'number') {
          cell.numFmt = FMT.integer;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      } else if (ci === 2) {
        cell.numFmt = FMT.currencyNoSign;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (ci === 5 || ci === 6 || ci === 7 || ci === 8) {
        cell.numFmt = FMT.integer;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.numFmt = '@';
      }
    });
    r++;
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: unidadesHeaderRow, activeCell: 'A1' }];
  ws.autoFilter = { from: { row: unidadesHeaderRow, column: 1 }, to: { row: unidadesHeaderRow, column: colCount } };
  ws.properties.tabColor = { argb: argb(C.navy) };
}

function buildIncidenciasSheet(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  data: HrWeeklyResponse,
  opts: HrWeeklyExcelOptions,
  remById: Map<string, HrWeeklyRemisionRow>,
) {
  const headers = [
    'Fecha hallazgo',
    'Planta',
    'Remisión',
    'Fecha remisión',
    'Tipo',
    'Conductor',
    'Unidad',
    'Regla',
    'Severidad',
    'Mensaje',
  ];
  const colCount = headers.length;
  ws.columns = [12, 10, 12, 12, 11, 22, 14, 28, 10, 48].map((w) => ({ width: w }));

  let r = applyTopBanner(ws, wb, colCount, 'RH — Incidencias de cumplimiento (detalle)', [
    ['Período', `${opts.startDate} — ${opts.endDate}`],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
    ['Nota', 'Una remisión puede tener varios hallazgos — aparece una fila por hallazgo.'],
  ]);
  ws.getRow(r).height = 6;
  r++;

  const incidenciasHeaderRow = r;
  const hr = ws.getRow(r);
  hr.height = 26;
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });
  r++;

  const flat: Array<{ rem: HrWeeklyRemisionRow | undefined; f: HrComplianceFinding }> = [];
  const comp = data.complianceByRemisionId ?? {};
  for (const [rid, findings] of Object.entries(comp)) {
    const rem = remById.get(rid);
    for (const f of findings) {
      flat.push({ rem, f });
    }
  }
  flat.sort((a, b) => {
    const da = a.f.targetDate.localeCompare(b.f.targetDate);
    if (da !== 0) return da;
    return (a.rem?.remision_number ?? '').localeCompare(b.rem?.remision_number ?? '');
  });

  for (let i = 0; i < flat.length; i++) {
    const { rem, f } = flat[i]!;
    const row = ws.getRow(r);
    row.height = 18;
    const st = dataStyle(i % 2 === 1);
    row.getCell(1).value = f.targetDate;
    row.getCell(2).value = f.plantCode;
    row.getCell(3).value = rem?.remision_number ?? '—';
    row.getCell(4).value = rem?.fecha ? new Date(`${rem.fecha}T12:00:00`) : '';
    row.getCell(4).numFmt = FMT.date;
    row.getCell(5).value = rem?.tipo_remision ?? '';
    row.getCell(6).value = rem?.conductor ?? '';
    row.getCell(7).value = rem?.unidad ?? '';
    row.getCell(8).value = HR_COMPLIANCE_RULE_LABELS[f.rule] ?? f.rule;
    row.getCell(9).value = f.severity;
    row.getCell(10).value = f.message;
    for (let ci = 1; ci <= colCount; ci++) Object.assign(row.getCell(ci), st);
    r++;
  }

  if (flat.length === 0) {
    ws.mergeCells(r, 1, r, colCount);
    ws.getCell(r, 1).value =
      'Sin hallazgos de cumplimiento vinculados a remisión en el período (o includeCompliance no disponible en exportación).';
    Object.assign(ws.getCell(r, 1), metaValueStyle());
    r++;
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: incidenciasHeaderRow, activeCell: 'A1' }];
  ws.autoFilter =
    flat.length > 0
      ? { from: { row: incidenciasHeaderRow, column: 1 }, to: { row: incidenciasHeaderRow, column: colCount } }
      : undefined;
  ws.properties.tabColor = { argb: argb(C.additionalRowTint) };
}

function buildReasignacionesSheet(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, data: HrWeeklyResponse, opts: HrWeeklyExcelOptions) {
  const headers = [
    'Fecha',
    'Remisión',
    'Tipo',
    'Conductor',
    'Unidad',
    'Cliente',
    'Obra',
    'Planta',
    'Prod. cruzada',
    'Detalle reasignación Arkik',
  ];
  const colCount = headers.length;
  ws.columns = [12, 12, 11, 22, 14, 26, 26, 12, 12, 52].map((w) => ({ width: w }));

  let r = applyTopBanner(ws, wb, colCount, 'RH — Solo remisiones con reasignación Arkik', [
    ['Período', `${opts.startDate} — ${opts.endDate}`],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
  ]);
  ws.getRow(r).height = 6;
  r++;

  const reasigHeaderRow = r;
  const hr = ws.getRow(r);
  hr.height = 26;
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    Object.assign(c, columnHeaderStyle());
  });
  r++;

  const list = data.rows.filter((x) => (x.reassignment_note ?? '').trim());
  const sorted = [...list].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));

  for (let i = 0; i < sorted.length; i++) {
    const row = ws.getRow(r);
    const rem = sorted[i]!;
    const pumping = isPumpingRow(rem);
    const st = pumping ? pumpingRowStyle() : dataStyle(i % 2 === 1);
    row.height = 20;
    row.getCell(1).value = rem.fecha ? new Date(`${rem.fecha}T12:00:00`) : '';
    row.getCell(1).numFmt = FMT.date;
    row.getCell(2).value = rem.remision_number ?? '';
    row.getCell(3).value = rem.tipo_remision ?? '';
    row.getCell(4).value = rem.conductor ?? '';
    row.getCell(5).value = rem.unidad ?? '';
    row.getCell(6).value = rem.order?.client?.business_name ?? '';
    row.getCell(7).value = rem.order?.construction_site ?? '';
    row.getCell(8).value = rem.plant?.code ?? rem.plant?.name ?? '';
    row.getCell(9).value = rem.is_production_record ? 'Sí' : 'No';
    row.getCell(10).value = rem.reassignment_note ?? '';
    for (let ci = 1; ci <= colCount; ci++) Object.assign(row.getCell(ci), st);
    r++;
  }

  if (sorted.length === 0) {
    ws.mergeCells(r, 1, r, colCount);
    ws.getCell(r, 1).value = 'Ninguna remisión del período tiene registro de reasignación en Arkik.';
    Object.assign(ws.getCell(r, 1), metaValueStyle());
    r++;
  }

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: reasigHeaderRow, activeCell: 'A1' }];
  ws.autoFilter =
    sorted.length > 0
      ? { from: { row: reasigHeaderRow, column: 1 }, to: { row: reasigHeaderRow, column: colCount } }
      : undefined;
  ws.properties.tabColor = { argb: argb(C.pumpingRowTint) };
}

function buildDetalleSheet(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, rows: HrWeeklyRemisionRow[], opts: HrWeeklyExcelOptions) {
  ws.columns = Array.from({ length: DET_COL_COUNT }, (_, i) => ({
    width: [12, 10, 11, 12, 22, 14, 11, 28, 26, 14, 12, 18, 36, 22, 32][i] ?? 14,
  }));

  const periodo = `${opts.startDate} — ${opts.endDate}`;
  let r = applyTopBanner(ws, wb, DET_COL_COUNT, 'RH — Detalle de remisiones (concreto y bombeo)', [
    ['Período', periodo],
    ['Generado', format(opts.generatedAt, 'dd/MM/yyyy HH:mm')],
    ['Registros', String(rows.length)],
  ]);

  ws.getRow(r).height = 4;
  r++;

  const detalleHeaderRow = r;
  const headerRow = ws.getRow(r);
  headerRow.height = 28;
  DET_HEADERS.forEach((h, ci) => {
    const cell = headerRow.getCell(ci + 1);
    cell.value = h;
    Object.assign(cell, columnHeaderStyle());
  });
  r++;

  const sorted = [...rows].sort((a, b) => {
    const fd = (a.fecha ?? '').localeCompare(b.fecha ?? '');
    if (fd !== 0) return fd;
    return String(a.remision_number ?? '').localeCompare(String(b.remision_number ?? ''));
  });

  let volSum = 0;
  sorted.forEach((rem, ri) => {
    const row = ws.getRow(r);
    row.height = 16;
    const pumping = isPumpingRow(rem);
    const style = pumping ? pumpingRowStyle() : dataStyle(ri % 2 === 1);
    volSum += Number(rem.volumen_fabricado) || 0;

    const hora = rem.hora_carga ? String(rem.hora_carga).slice(0, 8) : '';
    const vals: ExcelJS.CellValue[] = [
      rem.fecha ? new Date(`${rem.fecha}T12:00:00`) : '',
      hora,
      rem.tipo_remision ?? '',
      rem.remision_number ?? '',
      rem.conductor ?? '',
      rem.unidad ?? '',
      Number(rem.volumen_fabricado) || 0,
      rem.order?.client?.business_name ?? '',
      rem.order?.construction_site ?? '',
      rem.plant?.code ?? rem.plant?.name ?? '',
      rem.is_production_record ? 'Sí' : 'No',
      rem.billing_plant?.name ?? rem.cross_plant_billing_plant_id ?? '',
      rem.reassignment_note ?? '',
      rem.cancelled_reason ?? '',
      rem.order?.comentarios_internos ?? '',
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
    r++;
  });

  const totalRowIdx = r;
  const tr = ws.getRow(totalRowIdx);
  tr.height = 18;
  for (let ci = 1; ci <= DET_COL_COUNT; ci++) {
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

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: detalleHeaderRow, activeCell: 'A1' }];
  ws.autoFilter = {
    from: { row: detalleHeaderRow, column: 1 },
    to: { row: detalleHeaderRow, column: DET_COL_COUNT },
  };
  ws.properties.tabColor = { argb: argb(C.navy) };
}

/**
 * Full RH weekly workbook: resumen → conductores → unidades → incidencias → reasignaciones → detalle.
 */
export async function buildHrWeeklyRemisionesExcel(
  data: HrWeeklyResponse,
  opts: HrWeeklyExcelOptions,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DC Concretos';
  wb.lastModifiedBy = 'RH — Reporte semanal';
  wb.created = opts.generatedAt;
  wb.modified = opts.generatedAt;

  const rows = data.rows;
  const byDriverMov = aggregateByDriver(rows);
  const byUnitMov = aggregateByUnit(rows);
  const remById = remisionRowById(rows);

  buildResumenSheet(wb.addWorksheet('Resumen', { pageSetup: { fitToPage: true } }), wb, data, opts);
  buildConductoresSheet(
    wb.addWorksheet('Conductores', { pageSetup: { fitToPage: true, orientation: 'landscape' } }),
    wb,
    data,
    opts,
    byDriverMov,
  );
  buildUnidadesSheet(
    wb.addWorksheet('Unidades', { pageSetup: { fitToPage: true, orientation: 'landscape' } }),
    wb,
    data,
    opts,
    byUnitMov,
  );
  buildIncidenciasSheet(
    wb.addWorksheet('Incidencias', { pageSetup: { fitToPage: true, orientation: 'landscape' } }),
    wb,
    data,
    opts,
    remById,
  );
  buildReasignacionesSheet(
    wb.addWorksheet('Reasignaciones', { pageSetup: { fitToPage: true, orientation: 'landscape' } }),
    wb,
    data,
    opts,
  );
  buildDetalleSheet(
    wb.addWorksheet('Detalle remisiones', { pageSetup: { fitToPage: true, orientation: 'landscape' } }),
    wb,
    rows,
    opts,
  );

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
