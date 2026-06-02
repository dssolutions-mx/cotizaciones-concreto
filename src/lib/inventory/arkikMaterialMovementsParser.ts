import * as XLSX from 'xlsx';

/** One "Entrada" row from Arkik Movimientos de Material export. */
export type ArkikExcelEntry = {
  material: string;
  proveedor: string;
  remision: string;
  /** Cantidad en la unidad del bloque Arkik (p. ej. toneladas si unidad = T). */
  cantidad: number;
  /** Unidad del bloque (fila «Unidad de medida» o tercer segmento Material|Proveedor|UoM). */
  unit_arkik: string;
  fecha: string | null;
};

/** Arkik consumption / outbound movement without remisión (col 14 empty). */
export type ArkikExcelConsumo = {
  material: string;
  proveedor: string;
  movement_type: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

/** Devolución a proveedor — suele registrarse como ajuste negativo con notas. */
export type ArkikExcelRegresoProveedor = {
  material: string;
  proveedor: string;
  movement_type: string;
  remision: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
  notas: string;
};

export type ArkikParseResult = {
  entradas: ArkikExcelEntry[];
  consumos_sin_remision: ArkikExcelConsumo[];
  regresos_proveedor: ArkikExcelRegresoProveedor[];
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

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  return null;
}

/** True when Arkik remisión column is blank / not usable for matching. */
export function arkikRowHasRemision(remisionRaw: string): boolean {
  const s = remisionRaw.trim();
  if (!s) return false;
  if (/^0+([.,]0+)?$/.test(s.replace(/\s/g, ''))) return false;
  return true;
}

const CONSUMO_MOVEMENT_TYPES = new Set([
  'consumo',
  'consumición',
  'consumicion',
  'salida',
]);

export function isArkikConsumoMovementType(movementType: string): boolean {
  const t = movementType.trim().toLowerCase();
  if (CONSUMO_MOVEMENT_TYPES.has(t)) return true;
  return t.startsWith('consum');
}

export function isArkikRegresoProveedorMovementType(movementType: string): boolean {
  return /regreso\s*a\s*proveedor/i.test(movementType.trim());
}

export function isArkikEntradaMovementType(movementType: string): boolean {
  const t = movementType.trim().toLowerCase();
  return t === 'entrada' || t.startsWith('entrada ');
}

/** Movement type is often in col 5; fallback to col 0 when col 5 is blank. */
export function resolveArkikMovementType(row: unknown[]): string {
  const col5 = cellStr(row[5]);
  if (col5) return col5;
  const col0 = cellStr(row[0]);
  if (col0 && !/material\|proveedor/i.test(col0) && !/unidad/i.test(col0)) return col0;
  return '';
}

/** Texto libre en columnas de comentarios/notas (excluye columnas fijas del layout). */
export function extractArkikMovementNotes(row: unknown[]): string {
  const skip = new Set([0, 1, 5, 6, 9, 14]);
  let best = '';
  for (let i = 0; i < Math.min(row.length, 24); i++) {
    if (skip.has(i)) continue;
    const v = cellStr(row[i]);
    if (!v || v.length < 3) continue;
    if (/^(entrada|consumo|salida|regreso|material)/i.test(v)) continue;
    if (/^\d+([.,]\d+)?$/.test(v)) continue;
    if (v.length > best.length) best = v;
  }
  return best;
}

/** Row «Unidad de medida» (or similar) → code in col 6 / col 1 (T, kg, …). */
export function extractArkikUnitFromHeaderRow(row: unknown[]): string {
  const col0 = cellStr(row[0]);
  if (!/unidad/i.test(col0)) return '';
  for (const idx of [6, 1, 2, 3, 4, 5, 7, 8]) {
    const v = cellStr(row[idx]);
    if (!v || v === col0) continue;
    if (/unidad/i.test(v) && /medida/i.test(v)) continue;
    return v;
  }
  return '';
}

/**
 * Parse Arkik "Movimientos de Material" XLS/XLSX (sectioned by material).
 * Column layout: col0 header, col1 fecha, col5 tipo, col6 material block, col9 qty, col14 remisión.
 */
export function parseArkikMaterialMovementsWorkbook(
  workbook: XLSX.WorkBook,
  sheetIndex = 0
): ArkikParseResult {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  if (!sheet) {
    return { entradas: [], consumos_sin_remision: [], regresos_proveedor: [] };
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);

  let currentMaterial = '';
  let currentProveedor = '';
  let currentUnit = 'kg';
  const entradas: ArkikExcelEntry[] = [];
  const consumos_sin_remision: ArkikExcelConsumo[] = [];
  const regresos_proveedor: ArkikExcelRegresoProveedor[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const col0 = cellStr(row[0]);
    const col6 = cellStr(row[6]);
    const movementType = resolveArkikMovementType(row);
    const remisionRaw = cellStr(row[14]);
    const cantidad = toFloat(row[9]);
    const fecha = arkikExcelValueToDate(row[1], date1904);

    const unitFromRow = extractArkikUnitFromHeaderRow(row);
    if (unitFromRow) {
      currentUnit = unitFromRow;
      continue;
    }

    if (col0 === 'Material|Proveedor' && col6) {
      const parts = col6.split('|').map((p) => p.trim());
      currentMaterial = parts[0] ?? '';
      currentProveedor = parts[1] ?? '';
      if (parts[2]) currentUnit = parts[2];
    }

    if (isArkikEntradaMovementType(movementType) && arkikRowHasRemision(remisionRaw)) {
      entradas.push({
        material: currentMaterial,
        proveedor: currentProveedor,
        remision: remisionRaw,
        cantidad,
        unit_arkik: currentUnit,
        fecha,
      });
    } else if (isArkikRegresoProveedorMovementType(movementType)) {
      regresos_proveedor.push({
        material: currentMaterial,
        proveedor: currentProveedor,
        movement_type: movementType,
        remision: remisionRaw,
        cantidad,
        unit_arkik: currentUnit,
        fecha,
        notas: extractArkikMovementNotes(row),
      });
    } else if (
      isArkikConsumoMovementType(movementType) &&
      !arkikRowHasRemision(remisionRaw) &&
      cantidad > 0
    ) {
      consumos_sin_remision.push({
        material: currentMaterial,
        proveedor: currentProveedor,
        movement_type: movementType,
        cantidad,
        unit_arkik: currentUnit,
        fecha,
      });
    }
  }

  return { entradas, consumos_sin_remision, regresos_proveedor };
}

export async function parseArkikMaterialMovementsFile(file: File): Promise<ArkikParseResult> {
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
): ArkikParseResult {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true, cellDates: false })
    : XLSX.read(buffer, { type: 'array', raw: true, cellDates: false });
  return parseArkikMaterialMovementsWorkbook(workbook);
}
