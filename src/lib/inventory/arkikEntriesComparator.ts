import type {
  ArkikExcelEntryEnriched,
  ArkikExcelEntradaSinRemisionEnriched,
} from '@/lib/inventory/arkikApplyQuantityConversion';
import { arkikRowHasRemision } from '@/lib/inventory/arkikMaterialMovementsParser';
import type { ArkikConsumoComparisonResult } from '@/lib/inventory/arkikConsumoComparator';
import type { ArkikConsumoRemisionComparisonResult } from '@/lib/inventory/arkikConsumoRemisionComparator';
import type { ArkikRegresoComparisonResult } from '@/lib/inventory/arkikRegresoProveedorComparator';

export type ArkikSystemSource = 'entry' | 'adjustment';

export type ArkikDbEntry = {
  entry_number: string;
  material_code: string;
  supplier_name: string;
  supplier_invoice: string | null;
  notes: string | null;
  entry_date: string;
  quantity_received: number;
};

export type ArkikDbAdjustment = {
  adjustment_number: string;
  material_code: string;
  remision: string;
  adjustment_date: string;
  quantity_adjusted: number;
  adjustment_type: string;
  reference_type: string | null;
  reference_notes: string | null;
};

export type ArkikAdjustmentWithoutRemision = Omit<ArkikDbAdjustment, 'remision'>;

type ArkikSystemRecord = {
  source: ArkikSystemSource;
  material_code: string;
  remision: string;
  record_number: string;
  fecha: string;
  cantidad: number;
  detail: string;
  adjustment_type?: string;
};

export type ArkikMatchedRow = {
  material: string;
  remision: string;
  notas_excel: string;
  fecha_excel: string | null;
  cantidad_excel: number;
  unit_arkik: string;
  cantidad_excel_kg: number;
  proveedor_excel: string;
  system_source: ArkikSystemSource;
  record_number: string;
  fecha_db: string;
  cantidad_db: number;
  detail_db: string;
  adjustment_type?: string;
};

export type ArkikOnlyExcelRow = {
  material: string;
  remision: string;
  notas: string;
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  cantidad_kg: number;
  proveedor: string;
};

export type ArkikEntradaSinRemisionMatchedRow = {
  material: string;
  notas_excel: string;
  fecha_excel: string | null;
  cantidad_excel: number;
  unit_arkik: string;
  cantidad_excel_kg: number;
  proveedor_excel: string;
  entry_number: string;
  fecha_db: string;
  cantidad_db: number;
  notes_db: string | null;
  supplier_name: string;
};

export type ArkikEntradaSinRemisionOnlyExcelRow = {
  material: string;
  notas: string;
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  cantidad_kg: number;
  proveedor: string;
};

export type ArkikEntradaSinRemisionOnlyDbRow = {
  material: string;
  entry_number: string;
  fecha: string;
  cantidad: number;
  notes: string | null;
  supplier_name: string;
};

export type ArkikEntradasSinRemisionResult = {
  matched: ArkikEntradaSinRemisionMatchedRow[];
  only_excel: ArkikEntradaSinRemisionOnlyExcelRow[];
  only_db: ArkikEntradaSinRemisionOnlyDbRow[];
};

export type ArkikOnlyDbRow = {
  material: string;
  remision: string;
  system_source: ArkikSystemSource;
  record_number: string;
  fecha: string;
  cantidad: number;
  detail: string;
  adjustment_type?: string;
};

export type ArkikMaterialSummary = {
  matched: number;
  only_excel: number;
  only_db: number;
};

/** Match by material + remisión (entradas y ajustes positivos). */
export type ArkikComparisonResult = {
  matched: ArkikMatchedRow[];
  only_excel: ArkikOnlyExcelRow[];
  only_db: ArkikOnlyDbRow[];
  entradas_sin_remision: ArkikEntradasSinRemisionResult;
  adjustments_without_remision: ArkikAdjustmentWithoutRemision[];
  summary: Record<string, ArkikMaterialSummary>;
  meta: {
    excel_entrada_count: number;
    excel_entrada_sin_remision_count: number;
    db_entry_count: number;
    db_entry_sin_remision_count: number;
    db_adjustment_count: number;
    db_adjustment_without_remision_count: number;
  };
};

export type ArkikReconciliationResult = {
  con_remision: ArkikComparisonResult;
  consumo_con_remision: ArkikConsumoRemisionComparisonResult;
  consumo_sin_remision: ArkikConsumoComparisonResult;
  regreso_proveedor: ArkikRegresoComparisonResult;
};

export function buildArkikReconciliationResult(
  conRemision: ArkikComparisonResult,
  consumoConRemision: ArkikConsumoRemisionComparisonResult,
  consumoSinRemision: ArkikConsumoComparisonResult,
  regresoProveedor: ArkikRegresoComparisonResult
): ArkikReconciliationResult {
  return {
    con_remision: conRemision,
    consumo_con_remision: consumoConRemision,
    consumo_sin_remision: consumoSinRemision,
    regreso_proveedor: regresoProveedor,
  };
}

/** Strip leading zeros so "085191" and "85191" match. */
export function normalizeRemision(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/^0+/, '');
  return s.length > 0 ? s : '0';
}

/** Case-insensitive material code for Arkik ↔ sistema keys. */
export function normalizeArkikMaterialKey(material: string): string {
  return material.trim().toUpperCase();
}

type CompositeKey = string;

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

function entryToSystemRecord(entry: ArkikDbEntry): ArkikSystemRecord | null {
  const remision = normalizeRemision(entry.supplier_invoice);
  if (remision == null) return null;
  return {
    source: 'entry',
    material_code: normalizeArkikMaterialKey(entry.material_code),
    remision,
    record_number: entry.entry_number,
    fecha: entry.entry_date,
    cantidad: entry.quantity_received,
    detail: entry.supplier_name,
  };
}

function adjustmentToSystemRecord(adj: ArkikDbAdjustment): ArkikSystemRecord {
  return {
    source: 'adjustment',
    material_code: normalizeArkikMaterialKey(adj.material_code),
    remision: adj.remision,
    record_number: adj.adjustment_number,
    fecha: adj.adjustment_date,
    cantidad: adj.quantity_adjusted,
    detail: adj.reference_notes?.trim() || adj.reference_type || adj.adjustment_type,
    adjustment_type: adj.adjustment_type,
  };
}

function systemRecordsFromDb(
  dbEntries: ArkikDbEntry[],
  dbAdjustments: ArkikDbAdjustment[]
): ArkikSystemRecord[] {
  const records: ArkikSystemRecord[] = [];
  for (const e of dbEntries) {
    const row = entryToSystemRecord(e);
    if (row) records.push(row);
  }
  for (const a of dbAdjustments) {
    records.push(adjustmentToSystemRecord(a));
  }
  return records;
}

type EntradaSinRemisionKey = string;

function entradaSinRemisionKey(material: string, fecha: string | null, cantidadKg: number): EntradaSinRemisionKey {
  const q = (Math.round(cantidadKg * 1000) / 1000).toFixed(3);
  return `${normalizeArkikMaterialKey(material)}\0${fecha ?? ''}\0${q}`;
}

function dbEntryHasRemision(entry: ArkikDbEntry): boolean {
  return entry.supplier_invoice != null && arkikRowHasRemision(entry.supplier_invoice);
}

export function compareEntradasSinRemision(
  excelRows: ArkikExcelEntradaSinRemisionEnriched[],
  dbEntries: ArkikDbEntry[]
): ArkikEntradasSinRemisionResult {
  const dbSinRem = dbEntries.filter((e) => !dbEntryHasRemision(e));

  const xlsIndex = new Map<EntradaSinRemisionKey, ArkikExcelEntradaSinRemisionEnriched[]>();
  for (const row of excelRows) {
    const key = entradaSinRemisionKey(row.material, row.fecha, row.cantidad_kg);
    const list = xlsIndex.get(key) ?? [];
    list.push(row);
    xlsIndex.set(key, list);
  }

  const dbIndex = new Map<EntradaSinRemisionKey, ArkikDbEntry[]>();
  for (const entry of dbSinRem) {
    const key = entradaSinRemisionKey(
      entry.material_code,
      entry.entry_date,
      entry.quantity_received
    );
    const list = dbIndex.get(key) ?? [];
    list.push(entry);
    dbIndex.set(key, list);
  }

  const matched: ArkikEntradaSinRemisionMatchedRow[] = [];
  const only_excel: ArkikEntradaSinRemisionOnlyExcelRow[] = [];
  const only_db: ArkikEntradaSinRemisionOnlyDbRow[] = [];

  const allKeys = new Set<EntradaSinRemisionKey>([...xlsIndex.keys(), ...dbIndex.keys()]);

  for (const key of [...allKeys].sort()) {
    const inXls = xlsIndex.get(key) ?? [];
    const inDb = dbIndex.get(key) ?? [];
    const material = key.split('\0')[0] ?? '';

    if (inXls.length > 0 && inDb.length > 0) {
      for (const x of inXls) {
        for (const d of inDb) {
          matched.push({
            material,
            notas_excel: x.notas,
            fecha_excel: x.fecha,
            cantidad_excel: x.cantidad,
            unit_arkik: x.unit_arkik,
            cantidad_excel_kg: x.cantidad_kg,
            proveedor_excel: x.proveedor,
            entry_number: d.entry_number,
            fecha_db: d.entry_date,
            cantidad_db: d.quantity_received,
            notes_db: d.notes,
            supplier_name: d.supplier_name,
          });
        }
      }
    } else if (inXls.length > 0) {
      for (const x of inXls) {
        only_excel.push({
          material,
          notas: x.notas,
          fecha: x.fecha,
          cantidad: x.cantidad,
          unit_arkik: x.unit_arkik,
          cantidad_kg: x.cantidad_kg,
          proveedor: x.proveedor,
        });
      }
    } else {
      for (const d of inDb) {
        only_db.push({
          material,
          entry_number: d.entry_number,
          fecha: d.entry_date,
          cantidad: d.quantity_received,
          notes: d.notes,
          supplier_name: d.supplier_name,
        });
      }
    }
  }

  return { matched, only_excel, only_db };
}

export function compareArkikEntries(
  excelEntries: ArkikExcelEntryEnriched[],
  excelEntradasSinRemision: ArkikExcelEntradaSinRemisionEnriched[],
  dbEntries: ArkikDbEntry[],
  dbAdjustments: ArkikDbAdjustment[] = [],
  adjustmentsWithoutRemision: ArkikAdjustmentWithoutRemision[] = []
): ArkikComparisonResult {
  const dbEntriesConRemision = dbEntries.filter(dbEntryHasRemision);
  const entradasSinRemision = compareEntradasSinRemision(excelEntradasSinRemision, dbEntries);

  const systemRecords = systemRecordsFromDb(dbEntriesConRemision, dbAdjustments);

  const xlsIndex = new Map<CompositeKey, ArkikExcelEntryEnriched[]>();
  for (const entry of excelEntries) {
    const key = compositeKey(entry.material, normalizeRemision(entry.remision));
    const list = xlsIndex.get(key) ?? [];
    list.push(entry);
    xlsIndex.set(key, list);
  }

  const dbIndex = new Map<CompositeKey, ArkikSystemRecord[]>();
  for (const record of systemRecords) {
    const key = compositeKey(record.material_code, record.remision);
    const list = dbIndex.get(key) ?? [];
    list.push(record);
    dbIndex.set(key, list);
  }

  const matched: ArkikMatchedRow[] = [];
  const only_excel: ArkikOnlyExcelRow[] = [];
  const only_db: ArkikOnlyDbRow[] = [];

  const allKeys = new Set<CompositeKey>([...xlsIndex.keys(), ...dbIndex.keys()]);

  for (const key of [...allKeys].sort()) {
    const inXls = xlsIndex.get(key) ?? [];
    const inDb = dbIndex.get(key) ?? [];
    const { material, remision } = parseCompositeKey(key);

    if (inXls.length > 0 && inDb.length > 0) {
      for (const x of inXls) {
        for (const d of inDb) {
          matched.push({
            material,
            remision,
            notas_excel: x.notas,
            fecha_excel: x.fecha,
            cantidad_excel: x.cantidad,
            unit_arkik: x.unit_arkik,
            cantidad_excel_kg: x.cantidad_kg,
            proveedor_excel: x.proveedor,
            system_source: d.source,
            record_number: d.record_number,
            fecha_db: d.fecha,
            cantidad_db: d.cantidad,
            detail_db: d.detail,
            adjustment_type: d.adjustment_type,
          });
        }
      }
    } else if (inXls.length > 0) {
      for (const x of inXls) {
        only_excel.push({
          material,
          remision,
          notas: x.notas,
          fecha: x.fecha,
          cantidad: x.cantidad,
          unit_arkik: x.unit_arkik,
          cantidad_kg: x.cantidad_kg,
          proveedor: x.proveedor,
        });
      }
    } else {
      for (const d of inDb) {
        only_db.push({
          material,
          remision,
          system_source: d.source,
          record_number: d.record_number,
          fecha: d.fecha,
          cantidad: d.cantidad,
          detail: d.detail,
          adjustment_type: d.adjustment_type,
        });
      }
    }
  }

  const summary: Record<string, ArkikMaterialSummary> = {};
  const bump = (mat: string, field: keyof ArkikMaterialSummary) => {
    if (!summary[mat]) summary[mat] = { matched: 0, only_excel: 0, only_db: 0 };
    summary[mat][field] += 1;
  };
  for (const r of matched) bump(r.material, 'matched');
  for (const r of only_excel) bump(r.material, 'only_excel');
  for (const r of only_db) bump(r.material, 'only_db');

  return {
    matched,
    only_excel,
    only_db,
    entradas_sin_remision: entradasSinRemision,
    adjustments_without_remision: adjustmentsWithoutRemision,
    summary,
    meta: {
      excel_entrada_count: excelEntries.length,
      excel_entrada_sin_remision_count: excelEntradasSinRemision.length,
      db_entry_count: dbEntriesConRemision.length,
      db_entry_sin_remision_count: dbEntries.filter((e) => !dbEntryHasRemision(e)).length,
      db_adjustment_count: dbAdjustments.length,
      db_adjustment_without_remision_count: adjustmentsWithoutRemision.length,
    },
  };
}
