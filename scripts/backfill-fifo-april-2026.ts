/**
 * Backfill FIFO for all CONCRETO remisiones in a date range (default 2026-04-01 .. 2026-04-26).
 *
 * Usage (from repo root):
 *   FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> npx tsx --env-file=.env.local scripts/backfill-fifo-april-2026.ts
 *
 * Optional env:
 *   FIFO_BACKFILL_FROM / FIFO_BACKFILL_TO — date bounds (YYYY-MM-DD)
 *   FIFO_BACKFILL_REMISION_IDS — comma-separated remision UUIDs (if set, only those IDs are processed)
 *   FIFO_BACKFILL_RETRY_ONCE=1 — after the main pass, retry each remisión that had errors (once)
 *   FIFO_BACKFILL_EXIT_ZERO=1 — always exit 0 (use for CI when partial skips are expected)
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIFO_ALLOCATION_ACTOR_USER_ID
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { autoAllocateRemisionFIFO } from '../src/services/fifoPricingService';

const DEFAULT_FROM = '2026-04-01';
const DEFAULT_TO = '2026-04-26';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const actorId = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();
  const dateFrom = process.env.FIFO_BACKFILL_FROM ?? DEFAULT_FROM;
  const dateTo = process.env.FIFO_BACKFILL_TO ?? DEFAULT_TO;
  const targetedIds = process.env.FIFO_BACKFILL_REMISION_IDS?.trim();
  const retryOnce = process.env.FIFO_BACKFILL_RETRY_ONCE === '1' || process.env.FIFO_BACKFILL_RETRY_ONCE === 'true';
  const exitZeroOnPartial =
    process.env.FIFO_BACKFILL_EXIT_ZERO === '1' || process.env.FIFO_BACKFILL_EXIT_ZERO === 'true';

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!actorId) {
    console.error(
      'Missing FIFO_ALLOCATION_ACTOR_USER_ID (use a real user_profiles.id, e.g. EXECUTIVE)'
    );
    process.exit(1);
  }
  const allocationActorId: string = actorId;

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let ids: string[];
  if (targetedIds) {
    ids = targetedIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`Targeted remisiones (FIFO_BACKFILL_REMISION_IDS): ${ids.length}`);
  } else {
    const { data: rows, error } = await supabase
      .from('remisiones')
      .select('id')
      .eq('tipo_remision', 'CONCRETO')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: true });

    if (error) {
      console.error('Query remisiones:', error.message);
      process.exit(1);
    }
    ids = (rows ?? []).map((r) => r.id);
    console.log(`Range ${dateFrom}..${dateTo} CONCRETO remisiones: ${ids.length}`);
  }

  let ok = 0;
  let fail = 0;
  let totalAllocLines = 0;
  const failures: Array<{ remision_id: string; message: string }> = [];

  async function processRemision(rid: string): Promise<void> {
    const r = await autoAllocateRemisionFIFO(rid, actorId, { supabase });
    totalAllocLines += r.allocationsCreated;
    if (r.success) {
      ok++;
    } else {
      fail++;
      failures.push({
        remision_id: rid,
        message: JSON.stringify({ errors: r.errors, skipped: r.skipped }),
      });
    }
  }

  for (let i = 0; i < ids.length; i++) {
    const rid = ids[i];
    try {
      await processRemision(rid);
    } catch (e: unknown) {
      fail++;
      failures.push({
        remision_id: rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    if ((i + 1) % 50 === 0 || i === ids.length - 1) {
      console.log(`Progress ${i + 1}/${ids.length} ok=${ok} fail=${fail} alloc_lines=${totalAllocLines}`);
    }
  }

  if (retryOnce) {
    const retryIds = [...new Set(failures.map((f) => f.remision_id))];
    if (retryIds.length > 0) {
      console.log(`Retry pass: ${retryIds.length} remision(es)…`);
      for (const rid of retryIds) {
        const n = failures.filter((f) => f.remision_id === rid).length;
        fail -= n;
        for (let k = 0; k < n; k++) {
          const idx = failures.findIndex((f) => f.remision_id === rid);
          if (idx >= 0) failures.splice(idx, 1);
        }
        try {
          const r = await autoAllocateRemisionFIFO(rid, allocationActorId, { supabase });
          if (r.success) {
            ok++;
          } else {
            fail++;
            failures.push({
              remision_id: rid,
              message: JSON.stringify({ errors: r.errors, skipped: r.skipped, pass: 'retry' }),
            });
          }
        } catch (e: unknown) {
          fail++;
          failures.push({
            remision_id: rid,
            message: (e instanceof Error ? e.message : String(e)) + ' (retry)',
          });
        }
      }
    }
  }

  console.log('Done.', { ok, fail, totalAllocLines, failuresSample: failures.slice(0, 10) });
  if (failures.length > 10) {
    console.log(`... ${failures.length - 10} more failure entries`);
  }

  process.exit(exitZeroOnPartial || fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
