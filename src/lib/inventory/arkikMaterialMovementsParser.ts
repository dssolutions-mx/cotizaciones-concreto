import * as XLSX from 'xlsx';

/** One "Entrada" row from Arkik Movimientos de Material export. */
export type ArkikExcelEntry = {
  material: string;
  proveedor: string;
  remision: string;
  cantidad: number;
  fecha: string | null;
};

function cellStr(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function toFloat(val: unknown): number {
  try {
    return parseFloat(String(val).replace(/,/g, '')) || 0;
  } catch {
    return 0;
  }
}

/** Excel serial or string → YYYY-MM-DD (matches xlrd behavior for Arkik exports). */
export function arkikExcelValueToDate(val: unknown, date1904 = false): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const asNum =
    typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (!Number.isNaN(asNum) && asNum > 0) {
    const parsed = XLSX.SSF.parse_date_code(asNum, { date1904 });
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
  if (iso) return iso[0];
  return null;
}

/**
 * Parse Arkik "Movimientos de Material" XLS/XLSX (sectioned by material).
 * Column layout matches Arkik export: col0 header, col1 fecha, col5 tipo, col6 material block, col9 qty, col14 remisión.
 */
export function parseArkikMaterialMovementsWorkbook(
  workbook: XLSX.WorkBook,
  sheetIndex = 0
): ArkikExcelEntry[] {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);

  let currentMaterial = '';
  let currentProveedor = '';
  const entries: ArkikExcelEntry[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const col0 = cellStr(row[0]);
    const col5 = cellStr(row[5]);
    const col6 = cellStr(row[6]);

    if (col0 === 'Material|Proveedor' && col6) {
      const parts = col6.split('|');
      currentMaterial = (parts[0] ?? '').trim();
      currentProveedor = (parts[1] ?? '').trim();
    }

    if (col5 === 'Entrada') {
      entries.push({
        material: currentMaterial,
        proveedor: currentProveedor,
        remision: cellStr(row[14]),
        cantidad: toFloat(row[9]),
        fecha: arkikExcelValueToDate(row[1], date1904),
      });
    }
  }

  return entries;
}

export async function parseArkikMaterialMovementsFile(file: File): Promise<ArkikExcelEntry[]> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith('.csv') || file.type.includes('csv');

  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: 'string', raw: true, cellDates: false });
  } else {
    const buf = await file.arrayBuffer();
    workbook = XLSX.read(buf, {
      type: 'array',
      raw: true,
      cellDates: false,
    });
  }

  return parseArkikMaterialMovementsWorkbook(workbook);
}

export function parseArkikMaterialMovementsBuffer(
  buffer: ArrayBuffer,
  filename: string
): ArkikExcelEntry[] {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true, cellDates: false })
    : XLSX.read(buffer, { type: 'array', raw: true, cellDates: false });
  return parseArkikMaterialMovementsWorkbook(workbook);
}
