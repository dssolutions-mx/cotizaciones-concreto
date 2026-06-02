import type { ArkikExcelConsumoEnriched } from '@/lib/inventory/arkikApplyQuantityConversion';
import {
  normalizeArkikMaterialKey,
  type ArkikAdjustmentWithoutRemision,
  type ArkikDbAdjustment,
} from '@/lib/inventory/arkikEntriesComparator';

export type ArkikConsumoMatchedRow = {
  material: string;
  fecha: string | null;
  cantidad_excel: number;
  unit_arkik: string;
  cantidad_excel_kg: number;
  movement_type_excel: string;
  proveedor_excel: string;
  adjustment_number: string;
  fecha_db: string;
  cantidad_db: number;
  adjustment_type: string;
  detail_db: string;
};

export type ArkikConsumoOnlyExcelRow = {
  material: string;
  fecha: string | null;
  cantidad: number;
  unit_arkik: string;
  cantidad_kg: number;
  movement_type: string;
  proveedor: string;
};

export type ArkikConsumoOnlyDbRow = {
  material: string;
  fecha: string;
  cantidad: number;
  adjustment_number: string;
  adjustment_type: string;
  detail: string;
};

export type ArkikConsumoComparisonResult = {
  matched: ArkikConsumoMatchedRow[];
  only_excel: ArkikConsumoOnlyExcelRow[];
  only_db: ArkikConsumoOnlyDbRow[];
  /** Negative adjustments with remisión in reference — not compared on this lane. */
  negative_with_remision: ArkikDbAdjustment[];
  summary: Record<string, { matched: number; only_excel: number; only_db: number }>;
  meta: {
    excel_consumo_count: number;
    db_negative_without_remision_count: number;
    db_negative_with_remision_count: number;
  };
};

type ConsumoKey = string;

function qtyKey(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toFixed(3);
}

function consumoCompositeKey(material: string, fecha: string | null, cantidad: number): ConsumoKey {
  return `${normalizeArkikMaterialKey(material)}\0${fecha ?? ''}\0${qtyKey(cantidad)}`;
}

function parseConsumoKey(key: ConsumoKey): { material: string; fecha: string } {
  const parts = key.split('\0');
  return { material: parts[0] ?? '', fecha: parts[1] ?? '' };
}

export function compareArkikConsumosSinRemision(
  excelConsumos: ArkikExcelConsumoEnriched[],
  negativeAdjustments: ArkikAdjustmentWithoutRemision[],
  negativeWithRemision: ArkikDbAdjustment[] = []
): ArkikConsumoComparisonResult {
  const xlsIndex = new Map<ConsumoKey, ArkikExcelConsumoEnriched[]>();
  for (const row of excelConsumos) {
    const key = consumoCompositeKey(row.material, row.fecha, row.cantidad_kg);
    const list = xlsIndex.get(key) ?? [];
    list.push(row);
    xlsIndex.set(key, list);
  }

  const dbIndex = new Map<ConsumoKey, ArkikAdjustmentWithoutRemision[]>();
  for (const adj of negativeAdjustments) {
    const key = consumoCompositeKey(
      adj.material_code,
      adj.adjustment_date,
      adj.quantity_adjusted
    );
    const list = dbIndex.get(key) ?? [];
    list.push(adj);
    dbIndex.set(key, list);
  }

  const matched: ArkikConsumoMatchedRow[] = [];
  const only_excel: ArkikConsumoOnlyExcelRow[] = [];
  const only_db: ArkikConsumoOnlyDbRow[] = [];

  const allKeys = new Set<ConsumoKey>([...xlsIndex.keys(), ...dbIndex.keys()]);

  for (const key of [...allKeys].sort()) {
    const inXls = xlsIndex.get(key) ?? [];
    const inDb = dbIndex.get(key) ?? [];
    const { material, fecha } = parseConsumoKey(key);

    if (inXls.length > 0 && inDb.length > 0) {
      for (const x of inXls) {
        for (const d of inDb) {
          matched.push({
            material,
            fecha: fecha || x.fecha,
            cantidad_excel: x.cantidad,
            unit_arkik: x.unit_arkik,
            cantidad_excel_kg: x.cantidad_kg,
            movement_type_excel: x.movement_type,
            proveedor_excel: x.proveedor,
            adjustment_number: d.adjustment_number,
            fecha_db: d.adjustment_date,
            cantidad_db: d.quantity_adjusted,
            adjustment_type: d.adjustment_type,
            detail_db: d.reference_notes?.trim() || d.reference_type || d.adjustment_type,
          });
        }
      }
    } else if (inXls.length > 0) {
      for (const x of inXls) {
        only_excel.push({
          material,
          fecha: x.fecha,
          cantidad: x.cantidad,
          unit_arkik: x.unit_arkik,
          cantidad_kg: x.cantidad_kg,
          movement_type: x.movement_type,
          proveedor: x.proveedor,
        });
      }
    } else {
      for (const d of inDb) {
        only_db.push({
          material,
          fecha: d.adjustment_date,
          cantidad: d.quantity_adjusted,
          adjustment_number: d.adjustment_number,
          adjustment_type: d.adjustment_type,
          detail: d.reference_notes?.trim() || d.reference_type || d.adjustment_type,
        });
      }
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

  return {
    matched,
    only_excel,
    only_db,
    negative_with_remision: negativeWithRemision,
    summary,
    meta: {
      excel_consumo_count: excelConsumos.length,
      db_negative_without_remision_count: negativeAdjustments.length,
      db_negative_with_remision_count: negativeWithRemision.length,
    },
  };
}
