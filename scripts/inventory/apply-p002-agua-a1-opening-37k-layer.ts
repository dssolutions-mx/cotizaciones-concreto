/**
 * One-off: FIFO OPEN layer for P002 Agua A1 after material_adjustments ADJ-20260430-025.
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';
import { insertOpeningFifoLayerForInitialCount } from '../../src/lib/inventory/insertOpeningFifoLayerForInitialCount';
import { assertSupabaseServiceRoleKey } from '../lib/assertSupabaseServiceRoleKey';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const res = await insertOpeningFifoLayerForInitialCount(supabase, {
    adjustmentId: '221da791-39cf-4a9d-a9fd-cf39f268e045',
    adjustmentNumber: 'ADJ-20260430-025',
    plantId: '836cbbcf-67b2-4534-97cc-b83e71722ff7',
    materialId: 'ead3ea0b-ce9f-44ce-905a-bc7ac73fcc24',
    adjustmentDate: '2026-04-30',
    inventoryAfterFromAdjustment: 245568.81,
    quantityAdjusted: 37000,
    openingLayerQtyKgOverride: 37000,
    enteredBy: '7953371d-2484-466b-86cf-33adaac06c68',
  });

  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
