import {
  ARKIK_MOVEMENT_TYPES,
  type ArkikParseMeta,
} from '@/lib/inventory/arkikMaterialMovementsParser';

export type ArkikCategoryRow = {
  tipo: string;
  count: number;
  hint: string;
  /** Si esta categoría entra a alguna pestaña de conciliación. */
  revisar: boolean;
};

/** Línea compacta: `Entrada: 157 · Consumo: 1291 · …` (solo tipos con filas). */
export function formatArkikByTipoLine(meta: ArkikParseMeta): string {
  return ARKIK_MOVEMENT_TYPES.filter((tipo) => (meta.by_tipo[tipo] ?? 0) > 0)
    .map((tipo) => `${tipo}: ${meta.by_tipo[tipo]}`)
    .join(' · ');
}

export function buildArkikCategoryRows(meta: ArkikParseMeta): ArkikCategoryRow[] {
  return ARKIK_MOVEMENT_TYPES.map((tipo) => {
    const count = meta.by_tipo[tipo] ?? 0;
    if (count === 0) {
      return { tipo, count: 0, hint: '', revisar: false };
    }

    switch (tipo) {
      case 'Entrada':
        return {
          tipo,
          count,
          hint: 'Entrada en sistema (con o sin remisión según columna)',
          revisar: true,
        };
      case 'Entrada por Ajuste':
        return {
          tipo,
          count,
          hint: 'Ajuste positivo en sistema',
          revisar: true,
        };
      case 'Consumo': {
        const conRem = meta.consumo_con_remision;
        const sinRem = meta.consumo_sin_remision;
        const hint =
          conRem > 0
            ? `${conRem} con remisión → remisiones · ${sinRem} sin remisión → ajuste negativo`
            : 'Sin remisión → ajuste negativo en sistema';
        return { tipo, count, hint, revisar: conRem > 0 || sinRem > 0 };
      }
      case 'Salida por Ajuste':
        return {
          tipo,
          count,
          hint: 'Ajuste negativo en sistema (emparejar con ajuste −)',
          revisar: true,
        };
      case 'Regreso a proveedor':
        return {
          tipo,
          count,
          hint: 'Ajuste negativo en sistema',
          revisar: true,
        };
      default:
        return { tipo, count, hint: '', revisar: false };
    }
  }).filter((row) => row.count > 0);
}
