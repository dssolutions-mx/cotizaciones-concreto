/**
 * Price parsing where zero is valid (e.g. credit notes fully offsetting material cost).
 */

/** Returns a finite number, or null when value is missing/non-finite. Zero is valid. */
export function parseFinitePrice(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** landed_unit_price → unit_price → material_prices fallback → 0 */
export function resolveFifoLayerUnitPrice(
  entry: { landed_unit_price?: unknown; unit_price?: unknown },
  materialPriceFallback?: unknown,
): number {
  return (
    parseFinitePrice(entry.landed_unit_price) ??
    parseFinitePrice(entry.unit_price) ??
    parseFinitePrice(materialPriceFallback) ??
    0
  );
}

/** Whether a price is registered in a map (zero counts as priced). */
export function hasPriceInMap(map: Map<string, number>, key: string): boolean {
  return map.has(key);
}
