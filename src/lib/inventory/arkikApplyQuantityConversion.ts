import {
  arkikQuantityToKg,
  type MaterialUomHints,
} from '@/lib/inventory/arkikUnitConversion';
import type {
  ArkikParseResult,
  ArkikExcelEntry,
  ArkikExcelConsumo,
  ArkikExcelRegresoProveedor,
} from '@/lib/inventory/arkikMaterialMovementsParser';

export type ArkikExcelEntryEnriched = ArkikExcelEntry & {
  unit_arkik: string;
  cantidad_kg: number;
  conversion_note?: string;
};

export type ArkikExcelConsumoEnriched = ArkikExcelConsumo & {
  unit_arkik: string;
  cantidad_kg: number;
  conversion_note?: string;
};

export type ArkikExcelRegresoProveedorEnriched = ArkikExcelRegresoProveedor & {
  unit_arkik: string;
  cantidad_kg: number;
  conversion_note?: string;
};

export type ArkikParseResultEnriched = {
  entradas: ArkikExcelEntryEnriched[];
  consumos_sin_remision: ArkikExcelConsumoEnriched[];
  regresos_proveedor: ArkikExcelRegresoProveedorEnriched[];
};

function enrichEntry<T extends { material: string; cantidad: number; unit_arkik: string }>(
  row: T,
  uomMap: Map<string, MaterialUomHints>
): T & { cantidad_kg: number; conversion_note?: string } {
  const conv = arkikQuantityToKg(row.cantidad, row.unit_arkik, uomMap.get(row.material) ?? null);
  return {
    ...row,
    cantidad_kg: conv.cantidad_kg,
    conversion_note: conv.conversion_note,
  };
}

export function applyArkikQuantityConversion(
  parsed: ArkikParseResult,
  uomMap: Map<string, MaterialUomHints>
): ArkikParseResultEnriched {
  return {
    entradas: parsed.entradas.map((e) => enrichEntry(e, uomMap)),
    consumos_sin_remision: parsed.consumos_sin_remision.map((c) => enrichEntry(c, uomMap)),
    regresos_proveedor: parsed.regresos_proveedor.map((r) => enrichEntry(r, uomMap)),
  };
}
