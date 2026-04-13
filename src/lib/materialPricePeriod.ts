/**
 * Monthly step pricing for material_prices.period_start (first day of month).
 */

export type MaterialPriceRow = {
  id?: string;
  material_id: string | null;
  plant_id: string | null;
  price_per_unit: number;
  effective_date?: string;
  end_date?: string | null;
  period_start?: string;
  material_type?: string;
  created_by?: string | null;
  created_at?: string;
};

/** First day of month as yyyy-MM-dd in local calendar (for Mexico operations). */
export function startOfMonthDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function parseMonthStart(periodStart: string): Date {
  const [y, m] = periodStart.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function addMonths(periodStart: string, delta: number): string {
  const d = parseMonthStart(periodStart);
  d.setMonth(d.getMonth() + delta);
  return startOfMonthDate(d);
}

/**
 * Pick price valid for `asOf` (calendar date): latest row with period_start <= monthStart(asOf).
 * Prefers plant-specific rows over plant_id null. Assumes rows sorted by period_start desc per material.
 */
export function resolvePriceAtDate(
  prices: MaterialPriceRow[],
  materialId: string,
  plantId: string,
  asOf: Date
): number | null {
  const cap = startOfMonthDate(asOf);
  const candidates = prices.filter(
    (p) =>
      p.material_id === materialId &&
      (p.plant_id === plantId || p.plant_id == null) &&
      p.period_start != null &&
      p.period_start <= cap
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const pa = a.plant_id === plantId ? 0 : 1;
    const pb = b.plant_id === plantId ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (b.period_start || '').localeCompare(a.period_start || '');
  });
  const row = candidates[0];
  return row ? Number(row.price_per_unit) : null;
}

/** Latest price per material for quotes / calculator (max period_start <= today). */
export function latestPricePerMaterialForPlant(
  rows: MaterialPriceRow[],
  plantId: string,
  asOf: Date = new Date()
): Map<string, number> {
  const cap = startOfMonthDate(asOf);
  const map = new Map<string, number>();
  const byMaterial = new Map<string, MaterialPriceRow[]>();
  for (const r of rows) {
    if (!r.material_id || !r.period_start || r.period_start > cap) continue;
    if (r.plant_id !== plantId && r.plant_id != null) continue;
    const list = byMaterial.get(r.material_id) || [];
    list.push(r);
    byMaterial.set(r.material_id, list);
  }
  for (const [mid, list] of byMaterial) {
    list.sort((a, b) => {
      const pa = a.plant_id === plantId ? 0 : 1;
      const pb = b.plant_id === plantId ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.period_start || '').localeCompare(a.period_start || '');
    });
    const top = list[0];
    if (top) map.set(mid, Number(top.price_per_unit) || 0);
  }
  return map;
}
