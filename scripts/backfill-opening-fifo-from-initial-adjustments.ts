/**
 * Ensures each `initial_count` material_adjustments row has a matching FIFO opening layer in
 * material_entries (idempotent). Run after loading historical opening balances that predated
 * automatic layer creation.
 *
 * Usage (repo root):
 *   FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> npx tsx --env-file=.env.local scripts/backfill-opening-fifo-from-initial-adjustments.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: FIFO_ALLOCATION_ACTOR_USER_ID — fallback for entered_by/reviewed_by if adjustment.adjusted_by is missing
 *
 * OPEN material_entries use entry_date = **first day of the adjustment month** (e.g. 2026-04-01) and
 * entry_number prefix **0OPEN-** so March 31 pours do not consume April openings, and OPEN sorts before
 * ENT- on the same day. Layer size = inventory_after when positive (unless quantity_adjusted is larger),
 * else quantity_adjusted. Corrections with reference_type ending in `_opening` use sheet qty from
 * "hoja … TN" / "hoja … L" when present, else resolver. When `inventory_before < 0` and
 * `quantity_adjusted` exceeds `inventory_after`, the OPEN layer is capped at `inventory_after` (on-hand
 * after opening) so the layer is not larger than physical stock.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import {
  insertOpeningFifoLayerForInitialCount,
  parseOpeningSheetLayerQtyFromNotes,
} from '../src/lib/inventory/insertOpeningFifoLayerForInitialCount';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const actorFallback = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  try {
    assertSupabaseServiceRoleKey(key);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('material_adjustments')
    .select(
      'id, adjustment_number, plant_id, material_id, adjustment_date, quantity_adjusted, inventory_before, inventory_after, adjusted_by, adjustment_type, reference_type, reference_notes'
    )
    .in('adjustment_type', ['initial_count', 'correction'])
    .order('adjustment_date', { ascending: true });

  if (error) {
    console.error('Query material_adjustments:', error.message);
    process.exit(1);
  }

  const list = (rows ?? []).filter(
    (r) =>
      r.adjustment_type === 'initial_count' ||
      (r.adjustment_type === 'correction' &&
        typeof r.reference_type === 'string' &&
        r.reference_type.endsWith('_opening'))
  );
  console.log(`initial_count + correction(*_opening) adjustments: ${list.length}`);

  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (const r of list) {
    const enteredBy = r.adjusted_by || actorFallback;
    if (!enteredBy) {
      console.error(`SKIP ${r.adjustment_number}: no adjusted_by and FIFO_ALLOCATION_ACTOR_USER_ID unset`);
      fail++;
      continue;
    }
    const isOpeningCorrection =
      r.adjustment_type === 'correction' &&
      typeof r.reference_type === 'string' &&
      r.reference_type.endsWith('_opening');
    const sheetQty = isOpeningCorrection ? parseOpeningSheetLayerQtyFromNotes(r.reference_notes) : null;
    const res = await insertOpeningFifoLayerForInitialCount(supabase, {
      adjustmentId: r.id,
      adjustmentNumber: r.adjustment_number,
      plantId: r.plant_id,
      materialId: r.material_id,
      adjustmentDate: r.adjustment_date,
      inventoryAfterFromAdjustment: Number(r.inventory_after),
      quantityAdjusted: Number(r.quantity_adjusted),
      inventoryBeforeFromAdjustment: Number(r.inventory_before),
      enteredBy,
      ...(sheetQty != null ? { openingLayerQtyKgOverride: sheetQty } : {}),
    });
    if (!res.ok) {
      console.error(`FAIL ${r.adjustment_number}: ${res.error}`);
      fail++;
    } else if ('skipped' in res && res.skipped) {
      console.log(`SKIP ${r.adjustment_number}: ${res.skipReason}`);
      skipped++;
    } else if ('entryId' in res) {
      console.log(`OK ${r.adjustment_number} -> material_entries.id=${res.entryId}`);
      ok++;
    }
  }

  console.log(`Finished. processed=${list.length} ok_layers=${ok} skipped=${skipped} fail=${fail}`);
  if (fail === 0 && ok > 0) {
    console.log('');
    console.log('--- NEXT STEP (required for costed remisiones) ---');
    console.log(
      'Opening layers do not re-run FIFO on existing remisiones. Re-allocate FIFO for the month, e.g.:'
    );
    console.log(
      '  FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> FIFO_DATE_FROM=2026-04-01 FIFO_DATE_TO=2026-04-30 \\'
    );
    console.log('    npx tsx --env-file=.env.local scripts/backfill-fifo-remisiones-range.ts');
    console.log('');
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
