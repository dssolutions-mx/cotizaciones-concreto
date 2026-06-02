import type { ArkikExcelEntry } from '@/lib/inventory/arkikMaterialMovementsParser';

export type ArkikDbEntry = {
  entry_number: string;
  material_code: string;
  supplier_name: string;
  supplier_invoice: string | null;
  entry_date: string;
  quantity_received: number;
};

export type ArkikMatchedRow = {
  material: string;
  remision: string;
  fecha_excel: string | null;
  cantidad_excel: number;
  proveedor_excel: string;
  entry_number: string;
  fecha_db: string;
  cantidad_db: number;
  supplier_db: string;
};

export type ArkikOnlyExcelRow = {
  material: string;
  remision: string;
  fecha: string | null;
  cantidad: number;
  proveedor: string;
};

export type ArkikOnlyDbRow = {
  material: string;
  remision: string;
  entry_number: string;
  fecha: string;
  cantidad: number;
  supplier: string;
};

export type ArkikMaterialSummary = {
  matched: number;
  only_excel: number;
  only_db: number;
};

export type ArkikComparisonResult = {
  matched: ArkikMatchedRow[];
  only_excel: ArkikOnlyExcelRow[];
  only_db: ArkikOnlyDbRow[];
  summary: Record<string, ArkikMaterialSummary>;
  meta: {
    excel_entrada_count: number;
    db_entry_count: number;
  };
};

/** Strip leading zeros so "085191" and "85191" match. */
export function normalizeRemision(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/^0+/, '');
  return s.length > 0 ? s : '0';
}

type CompositeKey = string;

function compositeKey(material: string, remision: string | null): CompositeKey {
  return `${material}\0${remision ?? ''}`;
}

function parseCompositeKey(key: CompositeKey): { material: string; remision: string } {
  const idx = key.indexOf('\0');
  return {
    material: key.slice(0, idx),
    remision: key.slice(idx + 1),
  };
}

export function compareArkikEntries(
  excelEntries: ArkikExcelEntry[],
  dbEntries: ArkikDbEntry[]
): ArkikComparisonResult {
  const xlsIndex = new Map<CompositeKey, ArkikExcelEntry[]>();
  for (const entry of excelEntries) {
    const key = compositeKey(entry.material, normalizeRemision(entry.remision));
    const list = xlsIndex.get(key) ?? [];
    list.push(entry);
    xlsIndex.set(key, list);
  }

  const dbIndex = new Map<CompositeKey, ArkikDbEntry[]>();
  for (const entry of dbEntries) {
    const norm = normalizeRemision(entry.supplier_invoice);
    if (norm == null) continue;
    const key = compositeKey(entry.material_code, norm);
    const list = dbIndex.get(key) ?? [];
    list.push(entry);
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
            proveedor_excel: x.proveedor,
            entry_number: d.entry_number,
            fecha_db: d.entry_date,
            cantidad_db: d.quantity_received,
            supplier_db: d.supplier_name,
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
          proveedor: x.proveedor,
        });
      }
    } else {
      for (const d of inDb) {
        only_db.push({
          material,
          remision,
          entry_number: d.entry_number,
          fecha: d.entry_date,
          cantidad: d.quantity_received,
          supplier: d.supplier_name,
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
    summary,
    meta: {
      excel_entrada_count: excelEntries.length,
      db_entry_count: dbEntries.length,
    },
  };
}
