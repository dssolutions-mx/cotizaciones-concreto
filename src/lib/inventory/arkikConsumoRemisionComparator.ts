import type { ArkikExcelConsumoConRemisionEnriched } from '@/lib/inventory/arkikApplyQuantityConversion';
import { normalizeRemision, normalizeArkikMaterialKey } from '@/lib/inventory/arkikEntriesComparator';
import type { ArkikDbRemisionConsumo } from '@/lib/inventory/fetchRemisionConsumptionsForArkikComparison';

const QTY_DIFF_EPSILON = 0.01;

type CompositeKey = string;

export type ArkikConsumoRemisionMatchedRow = {
  material: string;
  remision: string;
  remision_raw: string;
  fecha_excel: string | null;
  cantidad_excel: number;
  unit_arkik: string;
  comentarios: string;
  fecha_db: string;
  cantidad_real_db: number;
  cantidad_teorica_db: number;
  diferencia: number;
  tiene_diferencia: boolean;
};

export type ArkikConsumoRemisionOnlyExcelRow = {
  material: string;
  remision: string;
  remision_raw: string;
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  comentarios: string;
};

export type ArkikConsumoRemisionOnlyDbRow = {
  material: string;
  remision: string;
  fecha: string;
  cantidad_real: number;
  cantidad_teorica: number;
};

export type ArkikConsumoRemisionMaterialSummary = {
  matched: number;
  only_excel: number;
  only_db: number;
  with_qty_diff: number;
};

export type ArkikConsumoRemisionComparisonResult = {
  matched: ArkikConsumoRemisionMatchedRow[];
  only_excel: ArkikConsumoRemisionOnlyExcelRow[];
  only_db: ArkikConsumoRemisionOnlyDbRow[];
  summary: Record<string, ArkikConsumoRemisionMaterialSummary>;
  meta: {
    excel_consumo_con_remision_count: number;
    db_remision_materiales_count: number;
    matched_with_qty_diff: number;
  };
};

/**
 * Convert "P001-027472" → "27472".
 * Strips everything up to and including the first dash, then leading zeros.
 */
export function normalizeArkikConsumoRemision(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let s = raw;
  const dashIdx = s.indexOf('-');
  if (dashIdx >= 0) {
    s = s.slice(dashIdx + 1);
  }
  s = s.replace(/^0+/, '');
  return s.length > 0 ? s : null;
}

function compositeKey(material: string, remision: string | null): CompositeKey {
  return `${normalizeArkikMaterialKey(material)}\0${remision ?? ''}`;
}

function parseCompositeKey(key: CompositeKey): { material: string; remision: string } {
  const idx = key.indexOf('\0');
  return {
    material: key.slice(0, idx),
    remision: key.slice(idx + 1),
  };
}

/**
 * Match Arkik Consumo rows (with remisión) against remision_materiales.
 * Match key: (material_code, normalized_remision). Quantities aggregated per pair.
 */
export function compareArkikConsumosConRemision(
  excelRows: ArkikExcelConsumoConRemisionEnriched[],
  dbRows: ArkikDbRemisionConsumo[]
): ArkikConsumoRemisionComparisonResult {
  type XlsAgg = {
    material: string;
    remision: string;
    remision_raw: string;
    cantidad: number;
    unit_arkik: string;
    fecha_mov: string | null;
    comentarios: string;
  };

  type DbAgg = {
    material_code: string;
    remision: string;
    fecha: string;
    cantidad_real: number;
    cantidad_teorica: number;
  };

  const xlsIndex = new Map<CompositeKey, XlsAgg>();
  for (const row of excelRows) {
    const remision = normalizeArkikConsumoRemision(row.remision);
    if (!remision) continue;
    const key = compositeKey(row.material, remision);
    const existing = xlsIndex.get(key);
    if (existing) {
      existing.cantidad += row.cantidad;
    } else {
      xlsIndex.set(key, {
        material: normalizeArkikMaterialKey(row.material),
        remision,
        remision_raw: row.remision,
        cantidad: row.cantidad,
        unit_arkik: row.unit_arkik,
        fecha_mov: row.fecha,
        comentarios: row.notas,
      });
    }
  }

  const dbIndex = new Map<CompositeKey, DbAgg>();
  for (const row of dbRows) {
    const remision = normalizeRemision(row.remision_number);
    if (remision == null) continue;
    const key = compositeKey(row.material_code, remision);
    const existing = dbIndex.get(key);
    if (existing) {
      existing.cantidad_real += row.cantidad_real;
      existing.cantidad_teorica += row.cantidad_teorica;
    } else {
      dbIndex.set(key, {
        material_code: normalizeArkikMaterialKey(row.material_code),
        remision,
        fecha: row.fecha,
        cantidad_real: row.cantidad_real,
        cantidad_teorica: row.cantidad_teorica,
      });
    }
  }

  const matched: ArkikConsumoRemisionMatchedRow[] = [];
  const only_excel: ArkikConsumoRemisionOnlyExcelRow[] = [];
  const only_db: ArkikConsumoRemisionOnlyDbRow[] = [];

  const allKeys = new Set<CompositeKey>([...xlsIndex.keys(), ...dbIndex.keys()]);

  for (const key of [...allKeys].sort()) {
    const x = xlsIndex.get(key);
    const d = dbIndex.get(key);
    const { material, remision } = parseCompositeKey(key);

    if (x && d) {
      const diff = Math.round((x.cantidad - d.cantidad_real) * 10000) / 10000;
      matched.push({
        material,
        remision,
        remision_raw: x.remision_raw,
        fecha_excel: x.fecha_mov,
        cantidad_excel: x.cantidad,
        unit_arkik: x.unit_arkik,
        comentarios: x.comentarios,
        fecha_db: d.fecha,
        cantidad_real_db: d.cantidad_real,
        cantidad_teorica_db: d.cantidad_teorica,
        diferencia: diff,
        tiene_diferencia: Math.abs(diff) > QTY_DIFF_EPSILON,
      });
    } else if (x) {
      only_excel.push({
        material,
        remision,
        remision_raw: x.remision_raw,
        fecha: x.fecha_mov,
        cantidad: x.cantidad,
        unit_arkik: x.unit_arkik,
        comentarios: x.comentarios,
      });
    } else if (d) {
      only_db.push({
        material,
        remision,
        fecha: d.fecha,
        cantidad_real: d.cantidad_real,
        cantidad_teorica: d.cantidad_teorica,
      });
    }
  }

  const summary: Record<string, ArkikConsumoRemisionMaterialSummary> = {};
  const bump = (
    mat: string,
    field: keyof Omit<ArkikConsumoRemisionMaterialSummary, 'with_qty_diff'>
  ) => {
    if (!summary[mat]) {
      summary[mat] = { matched: 0, only_excel: 0, only_db: 0, with_qty_diff: 0 };
    }
    summary[mat][field] += 1;
  };

  for (const r of matched) {
    bump(r.material, 'matched');
    if (r.tiene_diferencia) {
      if (!summary[r.material]) {
        summary[r.material] = { matched: 0, only_excel: 0, only_db: 0, with_qty_diff: 0 };
      }
      summary[r.material].with_qty_diff += 1;
    }
  }
  for (const r of only_excel) bump(r.material, 'only_excel');
  for (const r of only_db) bump(r.material, 'only_db');

  const matchedWithQtyDiff = matched.filter((r) => r.tiene_diferencia).length;

  return {
    matched,
    only_excel,
    only_db,
    summary,
    meta: {
      excel_consumo_con_remision_count: excelRows.length,
      db_remision_materiales_count: dbRows.length,
      matched_with_qty_diff: matchedWithQtyDiff,
    },
  };
}
