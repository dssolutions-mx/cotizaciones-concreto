import * as XLSX from 'xlsx';

/** One "Entrada" row from Arkik Movimientos de Material export (con remisión). */
export type ArkikExcelEntry = {
  material: string;
  proveedor: string;
  remision: string;
  /** Columna «Comentarios» del export tabular (no Usuario). */
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

/** Entrada Arkik sin remisión en col. remisión — revisión manual / match por fecha+cantidad. */
export type ArkikExcelEntradaSinRemision = {
  material: string;
  proveedor: string;
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

/** Arkik consumption / outbound movement without remisión. */
export type ArkikExcelConsumo = {
  material: string;
  proveedor: string;
  movement_type: string;
  notas: string;
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
  entradas_sin_remision: ArkikExcelEntradaSinRemision[];
  consumos_sin_remision: ArkikExcelConsumo[];
  regresos_proveedor: ArkikExcelRegresoProveedor[];
};

/** Column indices from a «Fecha de movimiento / Tipo / … / Comentarios» header row. */
export type ArkikTabularColumnMap = {
  fecha_movimiento: number;
  tipo_movimiento: number;
  cantidad: number;
  remision: number;
  comentarios: number;
  volumetrico: number;
  usuario: number;
  fecha_creacion: number;
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

function normalizeHeaderLabel(val: unknown): string {
  return cellStr(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
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

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
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

export function looksLikeArkikMovementType(value: string): boolean {
  if (!value.trim()) return false;
  return (
    isArkikEntradaMovementType(value) ||
    isArkikConsumoMovementType(value) ||
    isArkikRegresoProveedorMovementType(value)
  );
}

function findHeaderColumn(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

/**
 * Detect Arkik tabular header: Fecha de movimiento | Tipo | Cantidad | … | Comentarios.
 * Returns null for sectioned-only rows (Material|Proveedor blocks).
 */
export function detectArkikTabularColumnMap(row: unknown[]): ArkikTabularColumnMap | null {
  const headers = row.map((c) => normalizeHeaderLabel(c));
  const tipo = findHeaderColumn(headers, [/tipo de movimiento/, /^tipo movimiento$/]);
  const fechaMov = findHeaderColumn(headers, [
    /fecha de movimiento/,
    /^fecha movimiento$/,
  ]);
  if (tipo < 0 || fechaMov < 0) return null;

  const cantidad = findHeaderColumn(headers, [/^cantidad$/]);
  const remision = findHeaderColumn(headers, [/remision/]);
  const usuario = findHeaderColumn(headers, [/^usuario$/]);
  const fechaCreacion = findHeaderColumn(headers, [/fecha de creacion/, /^fecha creacion$/]);

  // Arkik layout: la columna después de «Fecha de creación» es siempre Comentarios.
  let comentarios = -1;
  if (fechaCreacion >= 0 && fechaCreacion + 1 < headers.length) {
    comentarios = fechaCreacion + 1;
  } else {
    comentarios = findHeaderColumn(headers, [/comentario/]);
    if (comentarios === usuario) comentarios = -1;
  }

  return {
    fecha_movimiento: fechaMov,
    tipo_movimiento: tipo,
    cantidad: cantidad >= 0 ? cantidad : 2,
    remision: remision >= 0 ? remision : 4,
    comentarios: comentarios >= 0 ? comentarios : -1,
    volumetrico: findHeaderColumn(headers, [/volumetrico/, /volumetr/]),
    usuario: usuario >= 0 ? usuario : -1,
    fecha_creacion: fechaCreacion >= 0 ? fechaCreacion : -1,
  };
}

function cellAt(row: unknown[], idx: number): string {
  if (idx < 0) return '';
  return cellStr(row[idx]);
}

/** Comentarios from mapped column (siguiente a Fecha de creación) — never Usuario. */
export function extractArkikComentarios(row: unknown[], colMap: ArkikTabularColumnMap | null): string {
  if (colMap) {
    if (colMap.comentarios >= 0) return cellAt(row, colMap.comentarios);
    if (colMap.fecha_creacion >= 0) return cellAt(row, colMap.fecha_creacion + 1);
  }
  return extractArkikMovementNotesLegacy(row);
}

/** Legacy sectioned layout: scan wide rows but skip usuario-like cells. */
function extractArkikMovementNotesLegacy(row: unknown[], date1904 = false): string {
  const skip = new Set([0, 1, 5, 6, 9, 14]);
  let best = '';
  for (let i = 0; i < Math.min(row.length, 24); i++) {
    if (skip.has(i)) continue;
    const v = cellStr(row[i]);
    if (!looksLikeArkikNoteCell(v, date1904)) continue;
    if (/^usuario$/i.test(v) || /^dosificador$/i.test(v)) continue;
    if (v.length > best.length) best = v;
  }
  return best;
}

function looksLikeArkikNoteCell(val: string, date1904 = false): boolean {
  if (!val || val.length < 2) return false;
  if (arkikExcelValueToDate(val, date1904) != null) return false;
  if (/^\d+([.,]\d+)?$/.test(val)) return false;
  if (/^(entrada|consumo|salida|regreso|material)/i.test(val)) return false;
  if (looksLikeArkikMovementType(val)) return false;
  return true;
}

/** @deprecated Prefer extractArkikComentarios with column map. */
export function extractArkikCommentAfterDate(row: unknown[], date1904 = false): string {
  return extractArkikMovementNotesLegacy(row, date1904);
}

/** @deprecated Prefer extractArkikComentarios with column map. */
export function extractArkikMovementNotes(row: unknown[], date1904 = false): string {
  return extractArkikMovementNotesLegacy(row, date1904);
}

/** Movement type: tabular col, else legacy cols that actually contain Entrada/Consumo/… */
export function resolveArkikMovementType(
  row: unknown[],
  colMap: ArkikTabularColumnMap | null = null
): string {
  if (colMap) {
    return cellAt(row, colMap.tipo_movimiento);
  }
  for (const idx of [1, 5, 0]) {
    const v = cellStr(row[idx]);
    if (v && looksLikeArkikMovementType(v)) return v;
  }
  return '';
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

type MovementBase = {
  material: string;
  proveedor: string;
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

function pushEntrada(
  buckets: ArkikParseResult,
  base: MovementBase,
  remisionRaw: string
) {
  if (arkikRowHasRemision(remisionRaw)) {
    buckets.entradas.push({ ...base, remision: remisionRaw });
  } else {
    buckets.entradas_sin_remision.push(base);
  }
}

function parseMovementRow(
  buckets: ArkikParseResult,
  ctx: {
    material: string;
    proveedor: string;
    unit: string;
    movementType: string;
    remisionRaw: string;
    cantidad: number;
    fecha: string | null;
    notas: string;
  }
) {
  const { movementType, remisionRaw, cantidad, fecha, notas, material, proveedor, unit } = ctx;
  const base: MovementBase = {
    material,
    proveedor,
    notas,
    cantidad,
    unit_arkik: unit,
    fecha,
  };

  if (isArkikEntradaMovementType(movementType) && cantidad > 0) {
    pushEntrada(buckets, base, remisionRaw);
  } else if (isArkikRegresoProveedorMovementType(movementType)) {
    buckets.regresos_proveedor.push({
      ...base,
      movement_type: movementType,
      remision: remisionRaw,
    });
  } else if (
    isArkikConsumoMovementType(movementType) &&
    !arkikRowHasRemision(remisionRaw) &&
    cantidad > 0
  ) {
    buckets.consumos_sin_remision.push({
      ...base,
      movement_type: movementType,
    });
  }
}

/**
 * Parse Arkik "Movimientos de Material" — sectioned blocks and/or tabular tables with header row.
 */
export function parseArkikMaterialMovementsWorkbook(
  workbook: XLSX.WorkBook,
  sheetIndex = 0
): ArkikParseResult {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
  const empty: ArkikParseResult = {
    entradas: [],
    entradas_sin_remision: [],
    consumos_sin_remision: [],
    regresos_proveedor: [],
  };
  if (!sheet) return empty;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);

  let currentMaterial = '';
  let currentProveedor = '';
  let currentUnit = 'kg';
  let colMap: ArkikTabularColumnMap | null = null;

  const buckets: ArkikParseResult = {
    entradas: [],
    entradas_sin_remision: [],
    consumos_sin_remision: [],
    regresos_proveedor: [],
  };

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const detected = detectArkikTabularColumnMap(row);
    if (detected) {
      colMap = detected;
      continue;
    }

    const col0 = cellStr(row[0]);
    const col6 = cellStr(row[6]);

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
      continue;
    }

    if (colMap) {
      const movementType = resolveArkikMovementType(row, colMap);
      if (!looksLikeArkikMovementType(movementType)) continue;

      const fecha = arkikExcelValueToDate(row[colMap.fecha_movimiento], date1904);
      const cantidad =
        colMap.cantidad >= 0 ? toFloat(row[colMap.cantidad]) : 0;
      const remisionRaw = cellAt(row, colMap.remision);
      const notas = extractArkikComentarios(row, colMap);

      parseMovementRow(buckets, {
        material: currentMaterial,
        proveedor: currentProveedor,
        unit: currentUnit,
        movementType,
        remisionRaw,
        cantidad,
        fecha,
        notas,
      });
      continue;
    }

    const movementType = resolveArkikMovementType(row, null);
    if (!looksLikeArkikMovementType(movementType)) continue;

    const remisionRaw = cellStr(row[14]);
    const cantidad = toFloat(row[9]);
    const fecha = arkikExcelValueToDate(row[1], date1904);
    const notas = extractArkikMovementNotesLegacy(row, date1904);

    parseMovementRow(buckets, {
      material: currentMaterial,
      proveedor: currentProveedor,
      unit: currentUnit,
      movementType,
      remisionRaw,
      cantidad,
      fecha,
      notas,
    });
  }

  return buckets;
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
