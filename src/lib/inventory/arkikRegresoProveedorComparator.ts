import {
  normalizeRemision,
  type ArkikDbAdjustment,
  type ArkikAdjustmentWithoutRemision,
} from '@/lib/inventory/arkikEntriesComparator';
import type { ArkikExcelRegresoProveedorEnriched } from '@/lib/inventory/arkikApplyQuantityConversion';
import { arkikRowHasRemision } from '@/lib/inventory/arkikMaterialMovementsParser';

export const REGRESO_PROVEEDOR_NOTE_PATTERN =
  /regreso\s*(a\s*)?proveedor|devoluci[oó]n\s*(a\s*)?proveedor|return\s+to\s+supplier/i;

export type ArkikRegresoMatchKind = 'remision' | 'fecha_cantidad' | 'notas';

export type ArkikRegresoMatchedRow = {
  material: string;
  remision: string | null;
  match_kind: ArkikRegresoMatchKind;
  fecha_excel: string | null;
  cantidad_excel: number;
  unit_arkik: string;
  cantidad_excel_kg: number;
  notas_excel: string;
  proveedor_excel: string;
  adjustment_number: string;
  fecha_db: string;
  cantidad_db: number;
  adjustment_type: string;
  notas_db: string;
};

export type ArkikRegresoOnlyExcelRow = {
  material: string;
  remision: string | null;
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  cantidad_kg: number;
  notas: string;
  proveedor: string;
  movement_type: string;
};

export type ArkikRegresoOnlyDbRow = {
  material: string;
  remision: string | null;
  fecha: string;
  cantidad: number;
  adjustment_number: string;
  adjustment_type: string;
  notas: string;
  reference_type: string | null;
};

/** Ajustes negativos con “regreso” en notas que no empataron con ninguna fila Arkik. */
export type ArkikRegresoDbReviewRow = ArkikRegresoOnlyDbRow & {
  matched_in_arkik: false;
};

export type ArkikRegresoComparisonResult = {
  matched: ArkikRegresoMatchedRow[];
  only_excel: ArkikRegresoOnlyExcelRow[];
  only_db: ArkikRegresoOnlyDbRow[];
  /** Ajustes en sistema con texto de regreso/devolución — revisar manualmente. */
  db_regreso_notes_review: ArkikRegresoDbReviewRow[];
  summary: Record<string, { matched: number; only_excel: number; only_db: number }>;
  meta: {
    excel_regreso_count: number;
    matched_by_remision: number;
    matched_by_fecha_cantidad: number;
    matched_by_notas: number;
  };
};

type RemisionKey = string;
type ConsumoKey = string;

function remisionKey(material: string, remision: string | null): RemisionKey {
  return `${material}\0${remision ?? ''}`;
}

function consumoKey(material: string, fecha: string | null, cantidadKg: number): ConsumoKey {
  const q = (Math.round(cantidadKg * 1000) / 1000).toFixed(3);
  return `${material}\0${fecha ?? ''}\0${q}`;
}

function normalizeNotesForMatch(notes: string): string {
  return notes
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function notesLikelyMatch(excelNotas: string, dbNotes: string | null): boolean {
  const a = normalizeNotesForMatch(excelNotas);
  const b = normalizeNotesForMatch(dbNotes ?? '');
  if (a.length < 8 || b.length < 8) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const token = a.split(' ').filter((t) => t.length >= 5);
  return token.some((t) => b.includes(t));
}

function adjustmentNotesText(adj: {
  reference_notes: string | null;
  reference_type: string | null;
  adjustment_type: string;
}): string {
  return (adj.reference_notes?.trim() || adj.reference_type?.trim() || adj.adjustment_type || '').trim();
}

function toOnlyDbRow(
  adj: ArkikAdjustmentWithoutRemision | ArkikDbAdjustment,
  remision: string | null
): ArkikRegresoOnlyDbRow {
  return {
    material: adj.material_code,
    remision,
    fecha: adj.adjustment_date,
    cantidad: adj.quantity_adjusted,
    adjustment_number: adj.adjustment_number,
    adjustment_type: adj.adjustment_type,
    notas: adjustmentNotesText(adj),
    reference_type: adj.reference_type,
  };
}

export function compareArkikRegresoProveedor(
  regresos: ArkikExcelRegresoProveedorEnriched[],
  negativeWithRemision: ArkikDbAdjustment[],
  negativeWithoutRemision: ArkikAdjustmentWithoutRemision[]
): ArkikRegresoComparisonResult {
  const matched: ArkikRegresoMatchedRow[] = [];
  const only_excel: ArkikRegresoOnlyExcelRow[] = [];
  const matchedDbNumbers = new Set<string>();

  let matchedByRemision = 0;
  let matchedByFechaCantidad = 0;
  let matchedByNotas = 0;

  const withRem = regresos.filter((r) => arkikRowHasRemision(r.remision));
  const sinRem = regresos.filter((r) => !arkikRowHasRemision(r.remision));

  const dbRemIndex = new Map<RemisionKey, ArkikDbAdjustment[]>();
  for (const adj of negativeWithRemision) {
    const key = remisionKey(adj.material_code, adj.remision);
    const list = dbRemIndex.get(key) ?? [];
    list.push(adj);
    dbRemIndex.set(key, list);
  }

  const dbQtyIndex = new Map<ConsumoKey, ArkikAdjustmentWithoutRemision[]>();
  for (const adj of negativeWithoutRemision) {
    const key = consumoKey(adj.material_code, adj.adjustment_date, adj.quantity_adjusted);
    const list = dbQtyIndex.get(key) ?? [];
    list.push(adj);
    dbQtyIndex.set(key, list);
  }

  const allNegativeForNotes: (ArkikAdjustmentWithoutRemision | ArkikDbAdjustment)[] = [
    ...negativeWithoutRemision,
    ...negativeWithRemision,
  ];

  const pushMatch = (
    x: ArkikExcelRegresoProveedorEnriched,
    d: ArkikAdjustmentWithoutRemision | ArkikDbAdjustment,
    kind: ArkikRegresoMatchKind
  ) => {
    matchedDbNumbers.add(d.adjustment_number);
    matched.push({
      material: x.material,
      remision: arkikRowHasRemision(x.remision) ? normalizeRemision(x.remision) : null,
      match_kind: kind,
      fecha_excel: x.fecha,
      cantidad_excel: x.cantidad,
      unit_arkik: x.unit_arkik,
      cantidad_excel_kg: x.cantidad_kg,
      notas_excel: x.notas,
      proveedor_excel: x.proveedor,
      adjustment_number: d.adjustment_number,
      fecha_db: d.adjustment_date,
      cantidad_db: d.quantity_adjusted,
      adjustment_type: d.adjustment_type,
      notas_db: adjustmentNotesText(d),
    });
    if (kind === 'remision') matchedByRemision += 1;
    else if (kind === 'fecha_cantidad') matchedByFechaCantidad += 1;
    else matchedByNotas += 1;
  };

  for (const x of withRem) {
    const norm = normalizeRemision(x.remision);
    const inDb = dbRemIndex.get(remisionKey(x.material, norm)) ?? [];
    if (inDb.length > 0) {
      for (const d of inDb) pushMatch(x, d, 'remision');
    } else {
      const byNotes = allNegativeForNotes.filter(
        (d) =>
          !matchedDbNumbers.has(d.adjustment_number) &&
          d.material_code === x.material &&
          notesLikelyMatch(x.notas, adjustmentNotesText(d))
      );
      if (byNotes.length > 0) {
        pushMatch(x, byNotes[0], 'notas');
      } else {
        only_excel.push({
          material: x.material,
          remision: norm,
          fecha: x.fecha,
          cantidad: x.cantidad,
          unit_arkik: x.unit_arkik,
          cantidad_kg: x.cantidad_kg,
          notas: x.notas,
          proveedor: x.proveedor,
          movement_type: x.movement_type,
        });
      }
    }
  }

  for (const x of sinRem) {
    const key = consumoKey(x.material, x.fecha, x.cantidad_kg);
    const inDb = dbQtyIndex.get(key) ?? [];
    if (inDb.length > 0) {
      for (const d of inDb) pushMatch(x, d, 'fecha_cantidad');
    } else {
      const byNotes = allNegativeForNotes.filter(
        (d) =>
          !matchedDbNumbers.has(d.adjustment_number) &&
          d.material_code === x.material &&
          notesLikelyMatch(x.notas, adjustmentNotesText(d))
      );
      if (byNotes.length > 0) {
        pushMatch(x, byNotes[0], 'notas');
      } else {
        only_excel.push({
          material: x.material,
          remision: null,
          fecha: x.fecha,
          cantidad: x.cantidad,
          unit_arkik: x.unit_arkik,
          cantidad_kg: x.cantidad_kg,
          notas: x.notas,
          proveedor: x.proveedor,
          movement_type: x.movement_type,
        });
      }
    }
  }

  const only_db: ArkikRegresoOnlyDbRow[] = [];
  const db_regreso_notes_review: ArkikRegresoDbReviewRow[] = [];

  for (const adj of negativeWithRemision) {
    const notes = adjustmentNotesText(adj);
    const isRegresoNote = REGRESO_PROVEEDOR_NOTE_PATTERN.test(notes);
    if (matchedDbNumbers.has(adj.adjustment_number)) continue;
    const row = toOnlyDbRow(adj, adj.remision);
    if (isRegresoNote) {
      db_regreso_notes_review.push({ ...row, matched_in_arkik: false });
    } else {
      only_db.push(row);
    }
  }

  for (const adj of negativeWithoutRemision) {
    const notes = adjustmentNotesText(adj);
    const isRegresoNote = REGRESO_PROVEEDOR_NOTE_PATTERN.test(notes);
    if (matchedDbNumbers.has(adj.adjustment_number)) continue;
    const row = toOnlyDbRow(adj, null);
    if (isRegresoNote) {
      db_regreso_notes_review.push({ ...row, matched_in_arkik: false });
    } else {
      only_db.push(row);
    }
  }

  const summary: Record<string, { matched: number; only_excel: number; only_db: number }> = {};
  const bump = (mat: string, field: 'matched' | 'only_excel' | 'only_db') => {
    if (!summary[mat]) summary[mat] = { matched: 0, only_excel: 0, only_db: 0 };
    summary[mat][field] += 1;
  };
  for (const r of matched) bump(r.material, 'matched');
  for (const r of only_excel) bump(r.material, 'only_excel');
  for (const r of only_db) bump(r.material, 'only_db');
  for (const r of db_regreso_notes_review) bump(r.material, 'only_db');

  return {
    matched,
    only_excel,
    only_db,
    db_regreso_notes_review,
    summary,
    meta: {
      excel_regreso_count: regresos.length,
      matched_by_remision: matchedByRemision,
      matched_by_fecha_cantidad: matchedByFechaCantidad,
      matched_by_notas: matchedByNotas,
    },
  };
}
