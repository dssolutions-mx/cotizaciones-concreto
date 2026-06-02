import type { ArkikExcelEntryEnriched } from '@/lib/inventory/arkikApplyQuantityConversion';
import type { ArkikConsumoComparisonResult } from '@/lib/inventory/arkikConsumoComparator';
import type { ArkikRegresoComparisonResult } from '@/lib/inventory/arkikRegresoProveedorComparator';

export type ArkikSystemSource = 'entry' | 'adjustment';

export type ArkikDbEntry = {
  entry_number: string;
  material_code: string;
  supplier_name: string;
  supplier_invoice: string | null;
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
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  cantidad_kg: number;
  proveedor: string;
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
  adjustments_without_remision: ArkikAdjustmentWithoutRemision[];
  summary: Record<string, ArkikMaterialSummary>;
  meta: {
    excel_entrada_count: number;
    db_entry_count: number;
    db_adjustment_count: number;
    db_adjustment_without_remision_count: number;
  };
};

export type ArkikReconciliationResult = {
  con_remision: ArkikComparisonResult;
  consumo_sin_remision: ArkikConsumoComparisonResult;
  regreso_proveedor: ArkikRegresoComparisonResult;
};

export function buildArkikReconciliationResult(
  conRemision: ArkikComparisonResult,
  consumoSinRemision: ArkikConsumoComparisonResult,
  regresoProveedor: ArkikRegresoComparisonResult
): ArkikReconciliationResult {
  return {
    con_remision: conRemision,
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

export function compareArkikEntries(
  excelEntries: ArkikExcelEntryEnriched[],
  dbEntries: ArkikDbEntry[],
  dbAdjustments: ArkikDbAdjustment[] = [],
  adjustmentsWithoutRemision: ArkikAdjustmentWithoutRemision[] = []
): ArkikComparisonResult {
  const systemRecords = systemRecordsFromDb(dbEntries, dbAdjustments);

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
    adjustments_without_remision: adjustmentsWithoutRemision,
    summary,
    meta: {
      excel_entrada_count: excelEntries.length,
      db_entry_count: dbEntries.length,
      db_adjustment_count: dbAdjustments.length,
      db_adjustment_without_remision_count: adjustmentsWithoutRemision.length,
    },
  };
}
