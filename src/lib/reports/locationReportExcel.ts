import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { DC_DOCUMENT_THEME as C, DC_NUMBER_FORMATS as FMT, getDocumentContact } from '@/lib/reports/branding';
import type {
  DeliveryPoint,
  LocationBreakdownRow,
  LocationReportSummary,
} from '@/lib/finanzas/locationReportCore';

function argb(hex: string, alpha = 'FF'): string {
  return alpha + hex.replace('#', '');
}

function titleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 14, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  };
}

function columnHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: argb(C.white) }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(C.navy) } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: { bottom: { style: 'medium', color: { argb: argb(C.green) } } },
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
    border: { bottom: { style: 'hair', color: { argb: argb(C.borderLight) } } },
  };
}

export interface LocationReportExcelConfig {
  dateRangeLabel: string;
  filterSummary: string;
  generatedAt?: Date;
}

export async function buildLocationReportExcel(
  summary: LocationReportSummary,
  byLocality: LocationBreakdownRow[],
  points: DeliveryPoint[],
  config: LocationReportExcelConfig
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DC Concretos';
  const contact = getDocumentContact();
  const generatedAt = config.generatedAt ?? new Date();

  const resumen = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 8 }] });
  resumen.mergeCells('A1:F1');
  resumen.getCell('A1').value = 'Distribución geográfica de entregas';
  resumen.getCell('A1').style = titleStyle();
  resumen.getRow(1).height = 22;

  resumen.getCell('A2').value = config.dateRangeLabel;
  resumen.getCell('A3').value = config.filterSummary;
  resumen.getCell('A4').value = `Generado: ${format(generatedAt, 'dd/MM/yyyy HH:mm')}`;
  resumen.getCell('A5').value = contact.phone ? `Contacto: ${contact.phone}` : '';

  const kpiRow = 7;
  const kpis: [string, string | number][] = [
    ['Órdenes con ubicación', summary.ordersWithLocation],
    ['Órdenes en rango', summary.totalOrders],
    ['Volumen total (m³)', summary.totalVolume],
    ['Monto total', summary.totalAmount],
    ['Precio prom. / m³', summary.avgPricePerM3],
  ];
  kpis.forEach(([label, value], i) => {
    const col = i + 1;
    resumen.getCell(kpiRow, col).value = label;
    resumen.getCell(kpiRow + 1, col).value = value;
    if (typeof value === 'number' && label.includes('Monto')) {
      resumen.getCell(kpiRow + 1, col).numFmt = FMT.currency;
    } else if (typeof value === 'number' && label.includes('m³')) {
      resumen.getCell(kpiRow + 1, col).numFmt = FMT.volume;
    }
  });

  const localidad = wb.addWorksheet('Por localidad');
  const locHeaders = [
    'Ciudad',
    'Colonia',
    'Estado',
    'Municipio',
    'Órdenes',
    'Volumen m³',
    'Monto',
    'Precio prom/m³',
  ];
  localidad.addRow(locHeaders).eachCell((c) => {
    c.style = columnHeaderStyle();
  });
  byLocality.forEach((row, idx) => {
    const r = localidad.addRow([
      row.locality,
      row.sublocality ?? '',
      row.administrativeArea1 ?? '',
      row.administrativeArea2 ?? '',
      row.orderCount,
      row.volume,
      row.amount,
      row.avgPricePerM3,
    ]);
    r.eachCell((c, col) => {
      c.style = dataStyle(idx % 2 === 1);
      if (col >= 6) c.numFmt = col === 6 ? FMT.volume : FMT.currency;
    });
  });
  localidad.columns = [
    { width: 22 },
    { width: 20 },
    { width: 16 },
    { width: 18 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  const puntos = wb.addWorksheet('Puntos');
  const ptHeaders = [
    'Orden',
    'Latitud',
    'Longitud',
    'Ciudad',
    'Colonia',
    'Estado',
    'Municipio',
    'Volumen m³',
    'Monto',
  ];
  puntos.addRow(ptHeaders).eachCell((c) => {
    c.style = columnHeaderStyle();
  });
  points.forEach((p, idx) => {
    const r = puntos.addRow([
      p.orderId,
      p.lat,
      p.lng,
      p.locality ?? '',
      p.sublocality ?? '',
      p.administrativeArea1 ?? '',
      p.administrativeArea2 ?? '',
      p.volume,
      p.amount,
    ]);
    r.eachCell((c, col) => {
      c.style = dataStyle(idx % 2 === 1);
      if (col >= 8) c.numFmt = col === 8 ? FMT.volume : FMT.currency;
    });
  });
  puntos.columns = [
    { width: 38 },
    { width: 12 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
