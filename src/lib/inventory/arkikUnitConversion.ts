import { KG_PER_METRIC_TON } from '@/lib/inventory/massUnits';

export type ArkikCanonicalUom = 'kg' | 't' | 'm3' | 'l' | 'unknown';

export type MaterialUomHints = {
  unit_of_measure?: string | null;
  bulk_density_kg_per_m3?: number | null;
  density_kg_per_l?: number | null;
  density?: number | null;
};

export type ArkikQtyConversion = {
  cantidad_kg: number;
  unit_arkik: string;
  unit_canonical: ArkikCanonicalUom;
  conversion_note?: string;
};

/** Arkik export codes (T, kg, …) → canonical UoM for conversion. */
export function normalizeArkikUnitCode(raw: string): ArkikCanonicalUom {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/³/g, '3')
    .replace(/\./g, '');
  if (!s) return 'unknown';
  if (s === 't' || s === 'ton' || s === 'tons' || s === 'tonelada' || s === 'toneladas' || s === 'tm') {
    return 't';
  }
  if (s === 'kg' || s === 'k' || s === 'kilo' || s === 'kilogramo' || s === 'kilogramos') {
    return 'kg';
  }
  if (s === 'm3' || s === 'm³' || s.startsWith('m3')) return 'm3';
  if (s === 'l' || s === 'lt' || s === 'litro' || s === 'litros') return 'l';
  return 'unknown';
}

function normalizeDbMaterialUom(raw: string | null | undefined): ArkikCanonicalUom {
  const u = (raw ?? '').toLowerCase().replace(/³/g, '3');
  if (u.includes('ton') || u === 't') return 't';
  if (u.includes('m3') || u.includes('kg/m')) return 'm3';
  if (u === 'l' || u.includes('litro')) return 'l';
  if (u.includes('kg')) return 'kg';
  return 'unknown';
}

/**
 * Convert Arkik movement quantity to kg (inventory/FIFO canonical).
 * `quantity_received` and `quantity_adjusted` in DB are stored in kg.
 */
export function arkikQuantityToKg(
  cantidad: number,
  unitArkikRaw: string,
  material?: MaterialUomHints | null
): ArkikQtyConversion {
  const unit_arkik = unitArkikRaw.trim() || '—';
  let unit = normalizeArkikUnitCode(unitArkikRaw);
  if (unit === 'unknown' && material?.unit_of_measure) {
    unit = normalizeDbMaterialUom(material.unit_of_measure);
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { cantidad_kg: 0, unit_arkik, unit_canonical: unit };
  }

  if (unit === 't') {
    return {
      cantidad_kg: cantidad * KG_PER_METRIC_TON,
      unit_arkik,
      unit_canonical: 't',
      conversion_note: `${cantidad} t → ${cantidad * KG_PER_METRIC_TON} kg`,
    };
  }

  if (unit === 'kg') {
    return { cantidad_kg: cantidad, unit_arkik, unit_canonical: 'kg' };
  }

  if (unit === 'm3') {
    const kgPerM3 =
      Number(material?.bulk_density_kg_per_m3) ||
      Number(material?.density) ||
      0;
    if (kgPerM3 > 0) {
      return {
        cantidad_kg: cantidad * kgPerM3,
        unit_arkik,
        unit_canonical: 'm3',
        conversion_note: `${cantidad} m³ × ${kgPerM3} kg/m³`,
      };
    }
    return {
      cantidad_kg: cantidad,
      unit_arkik,
      unit_canonical: 'm3',
      conversion_note: 'm³ sin densidad en catálogo — cantidad sin convertir',
    };
  }

  if (unit === 'l') {
    const kgPerL = Number(material?.density_kg_per_l) || 0;
    if (kgPerL > 0) {
      return {
        cantidad_kg: cantidad * kgPerL,
        unit_arkik,
        unit_canonical: 'l',
        conversion_note: `${cantidad} L × ${kgPerL} kg/L`,
      };
    }
    return {
      cantidad_kg: cantidad,
      unit_arkik,
      unit_canonical: 'l',
      conversion_note: 'L sin densidad en catálogo — cantidad sin convertir',
    };
  }

  return {
    cantidad_kg: cantidad,
    unit_arkik,
    unit_canonical: 'unknown',
    conversion_note: `Unidad «${unit_arkik}» no reconocida — revise catálogo`,
  };
}

export function formatArkikQtyWithKg(cantidad: number, unitArkik: string, cantidadKg: number): string {
  const u = unitArkik.trim() || '—';
  if (u.toLowerCase() === 'kg' || Math.abs(cantidad - cantidadKg) < 0.001) {
    return `${cantidad.toLocaleString('es-MX')} kg`;
  }
  return `${cantidad.toLocaleString('es-MX')} ${u} (${cantidadKg.toLocaleString('es-MX')} kg)`;
}
