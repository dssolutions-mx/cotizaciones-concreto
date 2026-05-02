/**
 * Diagnose "layers exhausted": compares (1) total kg booked into FIFO layers on/before a date vs
 * (2) cumulative BOM consumption for CONCRETO remisiones on/before that date — same plant/material.
 *
 * If demand_kg > supply_kg → openings/receipts are mathematically short for that window (data).
 * If demand_kg <= supply_kg but allocator still skips → investigate remaining_quantity_kg, ordering,
 * duplicate material IDs, or intraday sort (use --remision-id for cut line).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/diagnose-fifo-exhaustion.ts \
 *     --plant <uuid> --material <uuid> --as-of 2026-04-02
 *
 * Optional:
 *   --remision-id <uuid>  Only count BOM demand from remisiones strictly before this id in FIFO order
 *   --demand-from YYYY-MM-DD  Lower bound for BOM fecha (default: first day of --as-of month). Use this so
 *                             demand matches an "April opening + April pours" story instead of all history.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

const PAGE = 1000;

function parseArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim();
  return undefined;
}

/** Lexicographic tuple compare for remision FIFO order. */
function remisionSortKey(r: {
  fecha: string;
  remision_number: string | null;
  id: string;
}): [string, string, string] {
  const num = r.remision_number ?? '\uffff';
  return [r.fecha, num, r.id];
}

function firstDayOfCalendarMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-');
  return `${y}-${m}-01`;
}

function cmpRemision(
  a: { fecha: string; remision_number: string | null; id: string },
  b: { fecha: string; remision_number: string | null; id: string }
): number {
  const ka = remisionSortKey(a);
  const kb = remisionSortKey(b);
  if (ka[0] !== kb[0]) return ka[0].localeCompare(kb[0]);
  if (ka[1] !== kb[1]) return ka[1].localeCompare(kb[1], undefined, { numeric: true });
  return ka[2].localeCompare(kb[2]);
}

async function main(): Promise<void> {
  const plantId = parseArg('--plant');
  const materialId = parseArg('--material');
  const asOf = parseArg('--as-of');
  const stopBeforeRemisionId = parseArg('--remision-id');
  const demandFromArg = parseArg('--demand-from');

  const demandFrom = demandFromArg ?? process.env.FIFO_DIAG_DEMAND_FROM?.trim() ?? firstDayOfCalendarMonth(asOf);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!plantId || !materialId || !asOf) {
    console.error(
      'Usage: npx tsx --env-file=.env.local scripts/diagnose-fifo-exhaustion.ts --plant <uuid> --material <uuid> --as-of YYYY-MM-DD [--remision-id <uuid>]'
    );
    process.exit(1);
  }

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: mat } = await supabase
    .from('materials')
    .select('material_code, material_name, unit_of_measure')
    .eq('id', materialId)
    .single();

  const { data: plants } = await supabase.from('plants').select('code, name').eq('id', plantId).maybeSingle();

  console.log('=== FIFO exhaustion diagnosis ===\n');
  console.log(`plant: ${plants?.code ?? '?'} (${plantId})`);
  console.log(
    `material: ${mat?.material_code ?? '?'} ${mat?.material_name ?? '?'} (${materialId})`
  );
  console.log(`as-of fecha (pour ceiling): ${asOf}`);
  console.log(`BOM demand window: fecha >= ${demandFrom} AND fecha <= ${asOf}`);
  if (stopBeforeRemisionId) {
    console.log(`demand cut: BOM lines only from remisiones strictly before ${stopBeforeRemisionId} in FIFO order`);
  }
  console.log('');

  type LayerRow = {
    id: string;
    entry_number: string | null;
    entry_date: string | null;
    remaining_quantity_kg: number | null;
    received_qty_kg: number | null;
    quantity_received: number | string | null;
    notes: string | null;
    excluded_from_fifo: boolean | null;
  };

  const layers: LayerRow[] = [];
  let off = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, remaining_quantity_kg, received_qty_kg, quantity_received, notes, excluded_from_fifo'
      )
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .lte('entry_date', asOf)
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const batch = (data ?? []) as LayerRow[];
    layers.push(...batch);
    if (batch.length < PAGE) break;
    off += PAGE;
  }

  let supplyReceivedKg = 0;
  let remainingSumKg = 0;
  let excludedSkippedKg = 0;
  const openRows: string[] = [];

  for (const e of layers) {
    if (e.excluded_from_fifo) {
      const rx = e.received_qty_kg != null ? Number(e.received_qty_kg) : Number(e.quantity_received);
      if (Number.isFinite(rx)) excludedSkippedKg += rx;
      continue;
    }
    const received = e.received_qty_kg != null ? Number(e.received_qty_kg) : Number(e.quantity_received);
    if (Number.isFinite(received)) supplyReceivedKg += received;

    let rem = e.remaining_quantity_kg != null ? Number(e.remaining_quantity_kg) : received;
    remainingSumKg += rem;

    const en = (e.entry_number ?? '').toUpperCase();
    const n = (e.notes ?? '').toLowerCase();
    if (en.includes('OPEN') || n.includes('fifo_opening')) {
      openRows.push(
        `  ${e.entry_date}  ${e.entry_number ?? ''}  received=${Number(received).toFixed(3)} kg  remaining=${Number(rem).toFixed(3)}  id=${e.id.slice(0, 8)}…`
      );
    }
  }

  console.log('--- Layers (entry_date <= as-of, excluded_from_fifo=false for sums) ---');
  console.log(`  layer rows counted: ${layers.length}`);
  console.log(`  sum(received) booked into FIFO layers: ${supplyReceivedKg.toFixed(3)} kg`);
  console.log(`  sum(current remaining_quantity_kg or received if null): ${remainingSumKg.toFixed(3)} kg (live state)`);
  if (excludedSkippedKg > 0) {
    console.log(
      `  note: ${excludedSkippedKg.toFixed(3)} kg in excluded_from_fifo rows (not in FIFO) — check if any should be included`
    );
  }
  if (openRows.length > 0) {
    console.log('  OPEN / fifo_opening layers:');
    for (const line of openRows) console.log(line);
  } else {
    console.log('  (no entry_number OPEN* / fifo_opening notes on these rows — opening may use another pattern)');
  }
  console.log('');

  let stopKey: { fecha: string; remision_number: string | null; id: string } | null = null;
  if (stopBeforeRemisionId) {
    const { data: sr, error: e1 } = await supabase
      .from('remisiones')
      .select('id, fecha, remision_number')
      .eq('id', stopBeforeRemisionId)
      .single();
    if (e1 || !sr) {
      console.error('Could not load --remision-id');
      process.exit(1);
    }
    stopKey = sr;
  }

  /** BOM demand: paginate remision_materiales with remisiones filters (avoids loading every plant remisión id). */
  type RmRow = {
    cantidad_real: number | null;
    remision_id: string;
    remisiones: {
      id: string;
      fecha: string;
      remision_number: string | null;
      plant_id: string;
      tipo_remision: string | null;
    };
  };

  let demandKg = 0;
  const distinctRemisionForDemand = new Set<string>();
  let rmOff = 0;
  for (;;) {
    const { data: rows, error: rmErr } = await supabase
      .from('remision_materiales')
      .select(
        `
        cantidad_real,
        remision_id,
        remisiones!inner ( id, fecha, remision_number, plant_id, tipo_remision )
      `
      )
      .eq('material_id', materialId)
      .eq('remisiones.plant_id', plantId)
      .eq('remisiones.tipo_remision', 'CONCRETO')
      .gte('remisiones.fecha', demandFrom)
      .lte('remisiones.fecha', asOf)
      .gt('cantidad_real', 0)
      .order('id', { ascending: true })
      .range(rmOff, rmOff + PAGE - 1);

    if (rmErr) {
      console.error(rmErr.message);
      process.exit(1);
    }
    const batch = (rows ?? []) as unknown as RmRow[];
    if (batch.length === 0) break;

    for (const row of batch) {
      const r = row.remisiones;
      if (!r) continue;
      if (stopKey && cmpRemision(r, stopKey) >= 0) continue;
      demandKg += Number(row.cantidad_real);
      distinctRemisionForDemand.add(r.id);
    }

    if (batch.length < PAGE) break;
    rmOff += PAGE;
  }

  const { count: remCt } = await supabase
    .from('remisiones')
    .select('id', { count: 'exact', head: true })
    .eq('plant_id', plantId)
    .eq('tipo_remision', 'CONCRETO')
    .gte('fecha', demandFrom)
    .lte('fecha', asOf);

  console.log('--- BOM demand (CONCRETO, same plant/material) ---');
  console.log(
    `  CONCRETO remisiones (plant, ${demandFrom} .. ${asOf}): ${remCt ?? '?'}`
  );
  console.log(
    `  remisiones contributing BOM lines for this material: ${distinctRemisionForDemand.size}`
  );
  console.log(`  sum(cantidad_real) included: ${demandKg.toFixed(3)} kg`);
  if (stopKey) {
    console.log(
      `  (only remisiones strictly before ${stopBeforeRemisionId} in FIFO order: fecha → remision_number → id)`
    );
  }
  console.log('');

  const gap = supplyReceivedKg - demandKg;
  console.log('--- Balance (static book: sum layer received vs sum BOM) ---');
  console.log(`  supply_received_kg - demand_kg = ${gap.toFixed(3)} kg`);
  console.log(
    '  Note: supply is sum(received) on ALL FIFO layers dated ≤ as-of (includes prior months). Demand defaults to BOM in [demand-from, as-of] only.'
  );
  if (remainingSumKg < 0.01 && gap > 10) {
    console.log(
      '\n  Live remaining is ~0 but booked receipts exceed **this month\'s** BOM window → inventory was consumed by **earlier pours** (March / earlier April same pool), not "lost". Compare opening + receipts vs **cumulative** BOM from system start or run FIFO replay from month boundary.'
    );
  }
  if (gap < -0.01) {
    console.log(
      '\n  Interpretation: **Booked receipts/opening layers do not cover BOM demand** for this plant/material through the chosen window. Fix: increase opening layer qty, add/book receipts with entry_date <= pour, fix excluded_from_fifo, or fix BOM quantities — not "material invented that day".'
    );
  } else if (gap >= -0.01) {
    console.log(
      '\n  Interpretation: **Layer receipts >= BOM demand** for this aggregate window. If allocator still skips, check: (1) intraday order — demand before a failure may be higher than this cut; pass --remision-id of the failing remisión to count demand only before it. (2) Live `remaining_quantity_kg` out of sync — re-run month FIFO with include_allocated. (3) Wrong material_id on some lines vs layers.'
    );
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
