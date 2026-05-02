import type { Database } from '../../src/types/supabase';

export type GapRow = Database['public']['Functions']['fn_fifo_operational_gaps']['Returns'][number];

/** RPC rows matching stock snapshot shortage (align with fn_fifo_operational_gaps reason codes). */
export const FIFO_GAP_INSUFFICIENT_STOCK_REASON = 'INSUFFICIENT_STOCK_SNAPSHOT' as const;

export type InsufficientStockAggRow = {
  plant_id: string;
  plant_code: string;
  material_id: string;
  material_name: string;
  line_count: number;
  min_available_kg_leq_pour: number;
  max_cantidad_kg: number;
  sample_remision_id: string;
  sample_remision_fecha: string;
};

/**
 * Dedupe gap lines to one row per (plant, material) for data-fix prioritization.
 */
export function aggregateInsufficientStockSnapshot(rows: GapRow[]): InsufficientStockAggRow[] {
  const byKey = new Map<string, InsufficientStockAggRow>();

  for (const r of rows) {
    if (r.reason_code !== FIFO_GAP_INSUFFICIENT_STOCK_REASON) continue;
    const k = `${r.plant_id}|${r.material_id}`;
    const avail = Number(r.available_kg_leq_pour ?? 0);
    const qty = Number(r.cantidad_kg ?? 0);

    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, {
        plant_id: r.plant_id,
        plant_code: r.plant_code,
        material_id: r.material_id,
        material_name: r.material_name,
        line_count: 1,
        min_available_kg_leq_pour: avail,
        max_cantidad_kg: qty,
        sample_remision_id: r.remision_id,
        sample_remision_fecha: r.remision_fecha,
      });
      continue;
    }

    existing.line_count++;
    existing.min_available_kg_leq_pour = Math.min(existing.min_available_kg_leq_pour, avail);
    existing.max_cantidad_kg = Math.max(existing.max_cantidad_kg, qty);
  }

  return [...byKey.values()].sort((a, b) => b.line_count - a.line_count);
}

function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function insufficientStockAggToCsv(rows: InsufficientStockAggRow[]): string {
  const headers = [
    'plant_id',
    'plant_code',
    'material_id',
    'material_name',
    'line_count',
    'min_available_kg_leq_pour',
    'max_cantidad_kg',
    'sample_remision_id',
    'sample_remision_fecha',
  ] as const;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h as keyof InsufficientStockAggRow])).join(','));
  }
  return lines.join('\n');
}
