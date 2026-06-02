import * as XLSX from 'xlsx';

/** Arkik movement types as they appear in exports (exact labels). */
export const ARKIK_MOVEMENT_TYPES = [
  'Entrada',
  'Entrada por Ajuste',
  'Salida por Ajuste',
  'Consumo',
  'Regreso a proveedor',
] as const;

export type ArkikMovementTypeLabel = (typeof ARKIK_MOVEMENT_TYPES)[number];

function movementTypeLookupKey(label: string): string {
  return normalizeMovementTypeLabel(label).toLowerCase();
}

const MOVEMENT_TYPE_LOOKUP = new Map<string, ArkikMovementTypeLabel>(
  ARKIK_MOVEMENT_TYPES.map((t) => [movementTypeLookupKey(t), t])
);

/** Logical fields → column index within each material section (reset per block). */
export type ArkikSectionColumnMap = {
  fecha_mov: number;
  tipo: number;
  cantidad: number;
  volumetrico: number;
  remision: number;
  usuario: number;
  fecha_creacion: number;
  comentarios: number;
};

/** One "Entrada" row (Entrada | Entrada por Ajuste) con remisión. */
export type ArkikExcelEntry = {
  material: string;
  proveedor: string;
  movement_type: string;
  remision: string;
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

export type ArkikExcelEntradaSinRemision = {
  material: string;
  proveedor: string;
  movement_type: string;
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

/** Consumo | Salida por Ajuste (ajustes negativos en sistema). */
export type ArkikExcelConsumo = {
  material: string;
  proveedor: string;
  movement_type: string;
  notas: string;
  cantidad: number;
  unit_arkik: string;
  fecha: string | null;
};

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
  meta: {
    total_movements: number;
    by_tipo: Record<string, number>;
  };
};

/** @deprecated Use ArkikSectionColumnMap */
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

const HEADER_TO_FIELD: Record<string, keyof ArkikSectionColumnMap> = {
  'Fecha de movimiento': 'fecha_mov',
  'Tipo de movimiento': 'tipo',
  Cantidad: 'cantidad',
  Volumétrico: 'volumetrico',
  Remisión: 'remision',
  Usuario: 'usuario',
  'Fecha de creación': 'fecha_creacion',
  Comentarios: 'comentarios',
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

function normalizeMovementTypeLabel(val: string): string {
  return val.trim().replace(/\s+/g, ' ');
}

/** Resolve to canonical Arkik label, or null if unknown / empty. */
export function canonicalArkikMovementType(raw: string): ArkikMovementTypeLabel | null {
  return MOVEMENT_TYPE_LOOKUP.get(movementTypeLookupKey(raw)) ?? null;
}

/** Excel serial or string → YYYY-MM-DD. */
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
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

export function arkikRowHasRemision(remisionRaw: string): boolean {
  const s = remisionRaw.trim();
  if (!s) return false;
  if (/^0+([.,]0+)?$/.test(s.replace(/\s/g, ''))) return false;
  return true;
}

export function isArkikEntradaMovementType(movementType: string): boolean {
  const c = canonicalArkikMovementType(movementType);
  return c === 'Entrada' || c === 'Entrada por Ajuste';
}

export function isArkikConsumoMovementType(movementType: string): boolean {
  const c = canonicalArkikMovementType(movementType);
  return c === 'Consumo' || c === 'Salida por Ajuste';
}

export function isArkikRegresoProveedorMovementType(movementType: string): boolean {
  return canonicalArkikMovementType(movementType) === 'Regreso a proveedor';
}

export function looksLikeArkikMovementType(value: string): boolean {
  return canonicalArkikMovementType(value) != null;
}

/**
 * Per-section header row: col 1 = «Fecha de movimiento».
 * Maps exact header labels; Comentarios data is at header col + 1 (Arkik quirk).
 */
export function detectArkikSectionColumnMap(row: unknown[]): ArkikSectionColumnMap | null {
  if (cellStr(row[1]) !== 'Fecha de movimiento') return null;

  const partial: Partial<ArkikSectionColumnMap> = {};
  for (let j = 0; j < row.length; j++) {
    const label = cellStr(row[j]);
    const field = HEADER_TO_FIELD[label];
    if (field) partial[field] = j;
  }

  if (partial.tipo == null || partial.fecha_mov == null) return null;

  return {
    fecha_mov: partial.fecha_mov,
    tipo: partial.tipo,
    cantidad: partial.cantidad ?? 2,
    volumetrico: partial.volumetrico ?? -1,
    remision: partial.remision ?? 4,
    usuario: partial.usuario ?? -1,
    fecha_creacion: partial.fecha_creacion ?? -1,
    /** Header index for «Comentarios»; data read via extractArkikComentarios. */
    comentarios: partial.comentarios ?? -1,
  };
}

/** @deprecated Use detectArkikSectionColumnMap */
export function detectArkikTabularColumnMap(row: unknown[]): ArkikTabularColumnMap | null {
  const m = detectArkikSectionColumnMap(row);
  if (!m) return null;
  return {
    fecha_movimiento: m.fecha_mov,
    tipo_movimiento: m.tipo,
    cantidad: m.cantidad,
    remision: m.remision,
    comentarios: m.comentarios,
    volumetrico: m.volumetrico,
    usuario: m.usuario,
    fecha_creacion: m.fecha_creacion,
  };
}

function cellAt(row: unknown[], idx: number): string {
  if (idx < 0) return '';
  return cellStr(row[idx]);
}

export function extractArkikComentarios(
  row: unknown[],
  colMap: ArkikSectionColumnMap | null
): string {
  if (!colMap) return '';

  // Column after «Fecha de creación» holds comment text in most exports.
  if (colMap.fecha_creacion >= 0) {
    const afterCreacion = cellAt(row, colMap.fecha_creacion + 1);
    if (afterCreacion) return afterCreacion;
  }

  // Arkik quirk: «Comentarios» header at N, data often at N+1 (sometimes same column).
  if (colMap.comentarios >= 0) {
    const shifted = cellAt(row, colMap.comentarios + 1);
    if (shifted) return shifted;
    const direct = cellAt(row, colMap.comentarios);
    if (direct && colMap.usuario >= 0 && direct === cellAt(row, colMap.usuario)) {
      return shifted;
    }
    return direct;
  }

  return '';
}

export function extractArkikCommentAfterDate(row: unknown[], _date1904 = false): string {
  return extractArkikComentarios(row, detectArkikSectionColumnMap(row));
}

export function extractArkikMovementNotes(row: unknown[], date1904 = false): string {
  const map = detectArkikSectionColumnMap(row);
  if (map) return extractArkikComentarios(row, map);
  return extractArkikMovementNotesLegacy(row, date1904);
}

function extractArkikMovementNotesLegacy(row: unknown[], date1904 = false): string {
  let best = '';
  for (let i = 0; i < Math.min(row.length, 24); i++) {
    const v = cellStr(row[i]);
    if (!v || v.length < 2) continue;
    if (arkikExcelValueToDate(v, date1904)) continue;
    if (/^\d+([.,]\d+)?$/.test(v)) continue;
    if (canonicalArkikMovementType(v)) continue;
    if (v.length > best.length) best = v;
  }
  return best;
}

export function resolveArkikMovementType(
  row: unknown[],
  colMap: ArkikSectionColumnMap | null = null
): string {
  if (colMap) return cellAt(row, colMap.tipo);
  for (const idx of [1, 5, 0]) {
    const v = cellStr(row[idx]);
    if (canonicalArkikMovementType(v)) return v;
  }
  return '';
}

export function extractArkikUnitFromHeaderRow(row: unknown[]): string {
  const col2 = cellStr(row[2]);
  const col4 = cellStr(row[4]);
  if (col2 === 'Unidad de medida' && col4) return col4;

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
  movement_type: string;
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

function routeMovement(
  buckets: ArkikParseResult,
  ctx: MovementBase & { remisionRaw: string }
) {
  const { movement_type: movementType, remisionRaw, cantidad } = ctx;
  const canonical = canonicalArkikMovementType(movementType);
  if (!canonical) return;

  buckets.meta.by_tipo[canonical] = (buckets.meta.by_tipo[canonical] ?? 0) + 1;
  buckets.meta.total_movements += 1;

  if (isArkikEntradaMovementType(movementType)) {
    if (cantidad > 0) pushEntrada(buckets, ctx, remisionRaw);
    return;
  }

  if (isArkikRegresoProveedorMovementType(movementType)) {
    buckets.regresos_proveedor.push({
      ...ctx,
      remision: remisionRaw,
    });
    return;
  }

  if (isArkikConsumoMovementType(movementType) && cantidad > 0) {
    buckets.consumos_sin_remision.push(ctx);
  }
}

/**
 * Parse Arkik «Movimientos de Material» — sectioned by material, per-section column map.
 * Port of arkik_import_comparator.parse_arkik_xls.
 */
export function parseArkikMaterialMovementsWorkbook(
  workbook: XLSX.WorkBook,
  sheetIndex = 0
): ArkikParseResult {
  const empty: ArkikParseResult = {
    entradas: [],
    entradas_sin_remision: [],
    consumos_sin_remision: [],
    regresos_proveedor: [],
    meta: { total_movements: 0, by_tipo: {} },
  };

  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
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
  let colMap: ArkikSectionColumnMap | null = null;

  const buckets: ArkikParseResult = {
    entradas: [],
    entradas_sin_remision: [],
    consumos_sin_remision: [],
    regresos_proveedor: [],
    meta: { total_movements: 0, by_tipo: {} },
  };

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const col0 = cellStr(row[0]);
    const col6 = cellStr(row[6]);

    if (col0 === 'Material|Proveedor' && col6) {
      const parts = col6.split('|').map((p) => p.trim());
      currentMaterial = parts[0] ?? '';
      currentProveedor = parts[1] ?? '';
      if (parts[2]) currentUnit = parts[2];
      colMap = null;
      continue;
    }

    const col2 = cellStr(row[2]);
    const col4 = cellStr(row[4]);
    if (col2 === 'Unidad de medida' && col4) {
      currentUnit = col4;
      continue;
    }

    const detected = detectArkikSectionColumnMap(row);
    if (detected) {
      colMap = detected;
      continue;
    }

    if (!colMap) continue;

    const movementType = cellAt(row, colMap.tipo);
    if (!canonicalArkikMovementType(movementType)) continue;

    routeMovement(buckets, {
      material: currentMaterial,
      proveedor: currentProveedor,
      movement_type: movementType,
      notas: extractArkikComentarios(row, colMap),
      cantidad: colMap.cantidad >= 0 ? toFloat(row[colMap.cantidad]) : 0,
      unit_arkik: currentUnit,
      fecha: arkikExcelValueToDate(row[colMap.fecha_mov], date1904),
      remisionRaw: cellAt(row, colMap.remision),
    });
  }

  return buckets;
}

export async function parseArkikMaterialMovementsFile(file: File): Promise<ArkikParseResult> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith('.csv') || file.type.includes('csv');

  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true, cellDates: false })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, cellDates: false });

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
