/**
 * Re-run FIFO allocation for remisiones in a date range (e.g. after `backfill-opening-fifo-from-initial-adjustments.ts`).
 * Opening layers alone do not update `remisiones.fifo_status` or `remision_materiales` costs — this script does.
 *
 * Usage (repo root):
 *   FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> \
 *   FIFO_DATE_FROM=2026-04-01 FIFO_DATE_TO=2026-04-30 \
 *   npx tsx --env-file=.env.local scripts/backfill-fifo-remisiones-range.ts
 *
 * Optional:
 *   FIFO_PLANT_ID=<uuid>           — limit to one plant
 *   FIFO_TIPO_REMISION=CONCRETO    — if set, only this tipo_remision (e.g. full April CONCRETO all plants)
 *   FIFO_STATUSES=pending,partial,error — comma-separated (default: pending,partial,error)
 *   FIFO_INCLUDE_ALLOCATED=false   — set "true" to re-run even allocated (clears & rewrites per line via service)
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role JWT)
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { autoAllocateRemisionFIFO } from '../src/services/fifoPricingService';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';
import {
  countRemisionesForFifoBackfill,
  fetchRemisionRowsPaginatedForFifoBackfill,
} from './lib/fetchRemisionIdsForFifoBackfill';

const CHUNK = 40;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const actor = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();
  const dateFrom = process.env.FIFO_DATE_FROM?.trim() || '2026-04-01';
  const dateTo = process.env.FIFO_DATE_TO?.trim() || '2026-04-30';
  const plantId = process.env.FIFO_PLANT_ID?.trim();
  const tipoRemisionRaw = process.env.FIFO_TIPO_REMISION?.trim();
  const tipoRemision = tipoRemisionRaw || null;
  const includeAllocated = process.env.FIFO_INCLUDE_ALLOCATED === 'true';
  const statuses = (process.env.FIFO_STATUSES?.trim() || 'pending,partial,error')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  if (!actor) {
    console.error('Missing FIFO_ALLOCATION_ACTOR_USER_ID (user_profiles.id for allocation audit columns)');
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fetchOpts = {
    dateFrom,
    dateTo,
    plantId,
    tipoRemision,
    includeAllocated,
    statuses,
  };

  const [exactCount, remRows] = await Promise.all([
    countRemisionesForFifoBackfill(supabase, fetchOpts),
    fetchRemisionRowsPaginatedForFifoBackfill(supabase, fetchOpts),
  ]);

  const ids = remRows.map((r) => r.id);

  if (exactCount != null && exactCount !== ids.length) {
    console.error(
      `ERROR: DB count (${exactCount}) !== loaded (${ids.length}) — pagination bug; aborting.`
    );
    process.exit(1);
  }

  console.log(
    `Remisiones to process: ${ids.length}${exactCount != null ? ` (DB count ${exactCount})` : ''} (fecha ${dateFrom}..${dateTo}${plantId ? ` plant=${plantId}` : ''}${tipoRemision ? ` tipo=${tipoRemision}` : ''}${includeAllocated ? ' ALL statuses' : ` fifo_status in (${statuses.join(',')})`})`
  );

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    for (const rid of slice) {
      try {
        const r = await autoAllocateRemisionFIFO(rid, actor, { supabase });
        const bad = r.errors.length + (r.skipped?.length ?? 0);
        if (r.success && bad === 0) {
          ok++;
          console.log(`OK ${rid} allocations=${r.allocationsCreated}`);
        } else {
          console.log(
            `PARTIAL ${rid} success=${r.success} alloc=${r.allocationsCreated} err=${r.errors.length} skip=${r.skipped.length}`
          );
          if (r.errors.length) console.error('  errors:', JSON.stringify(r.errors.slice(0, 3)));
          if (r.skipped.length) console.error('  skipped:', JSON.stringify(r.skipped.slice(0, 3)));
          ok++;
        }
      } catch (e) {
        fail++;
        console.error(`FAIL ${rid}`, e instanceof Error ? e.message : e);
      }
    }
    console.log(`Progress ${Math.min(i + CHUNK, ids.length)}/${ids.length}`);
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
