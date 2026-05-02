/**
 * Read-only snapshot: effective FIFO-eligible inventory for one material/plant on a date.
 * Mirrors layer filters used by allocateFIFOConsumption (entry_date <= as-of, excluded_from_fifo = false).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-fifo-material-layers.ts \
 *     --plant <uuid> --material <uuid> --as-of 2026-04-01
 *
 * Paginates material_entries (1000 rows/page). Sums effective remaining using the same
 * initialization rule as FIFO (NULL remaining → received_qty_kg or quantity_received).
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

async function main(): Promise<void> {
  const plantId = parseArg('--plant');
  const materialId = parseArg('--material');
  const asOf = parseArg('--as-of');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!plantId || !materialId || !asOf) {
    console.error(
      'Usage: npx tsx --env-file=.env.local scripts/verify-fifo-material-layers.ts --plant <uuid> --material <uuid> --as-of YYYY-MM-DD'
    );
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    console.error('--as-of must be YYYY-MM-DD');
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

  type Row = {
    id: string;
    entry_date: string | null;
    remaining_quantity_kg: number | null;
    received_qty_kg: number | null;
    quantity_received: number | string | null;
  };

  const rows: Row[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('material_entries')
      .select('id, entry_date, remaining_quantity_kg, received_qty_kg, quantity_received')
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .eq('excluded_from_fifo', false)
      .lte('entry_date', asOf)
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  let effectiveRemainingSum = 0;
  let layersWithPositiveRemaining = 0;
  const uninitialized: string[] = [];

  for (const e of rows) {
    let rem: number;
    if (e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined) {
      rem = Number(e.remaining_quantity_kg);
    } else {
      rem = e.received_qty_kg != null ? Number(e.received_qty_kg) : Number(e.quantity_received);
      uninitialized.push(e.id);
    }
    if (rem > 0.000_001) layersWithPositiveRemaining++;
    effectiveRemainingSum += rem;
  }

  console.log(`plant_id=${plantId}`);
  console.log(`material_id=${materialId}`);
  console.log(`as_of=${asOf}`);
  console.log(`layers_fetched=${rows.length}`);
  console.log(`layers_with_remaining_gt_zero=${layersWithPositiveRemaining}`);
  console.log(`layers_with_null_remaining_use_received=${uninitialized.length}`);
  console.log(`effective_remaining_sum_kg=${effectiveRemainingSum.toFixed(6)}`);
  console.log(
    '\nCompare effective_remaining_sum_kg to gap report available_kg_leq_pour after a full FIFO replay; if zero here but receipts exist, check dates and excluded_from_fifo.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
