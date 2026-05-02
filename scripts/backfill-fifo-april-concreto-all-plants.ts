/**
 * April CONCRETO FIFO backfill for all plants (chronological per plant: fecha, remision_number, id).
 * Thin wrapper around {@link runFifoBackfillQueues} — for full pipeline (gaps + backfill + reports)
 * use `scripts/fifo-month-run.ts` (`npm run fifo:month-run`).
 *
 * Usage (repo root):
 *   FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> \
 *   npx tsx --env-file=.env.local scripts/backfill-fifo-april-concreto-all-plants.ts
 *
 * Or: npm run fifo:backfill:april-2026:concreto-all-plants
 *
 * Optional env: FIFO_DATE_FROM, FIFO_DATE_TO, FIFO_PLANT_ID, FIFO_TIPO_REMISION, FIFO_INCLUDE_ALLOCATED,
 * FIFO_RESET_ALLOCATIONS_BEFORE_BACKFILL (set false to skip the month allocation wipe when include_allocated),
 * FIFO_STATUSES, FIFO_FIRST_SKIP_CSV
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIFO_ALLOCATION_ACTOR_USER_ID
 */
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';
import { runFifoBackfillQueues } from './lib/fifoBackfillRemisionQueues';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const actor = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();
  const dateFrom = process.env.FIFO_DATE_FROM?.trim() || '2026-04-01';
  const dateTo = process.env.FIFO_DATE_TO?.trim() || '2026-04-30';
  const plantId = process.env.FIFO_PLANT_ID?.trim();
  const tipoRemision = process.env.FIFO_TIPO_REMISION?.trim() || 'CONCRETO';
  const includeAllocated = process.env.FIFO_INCLUDE_ALLOCATED !== 'false';
  const statuses = (process.env.FIFO_STATUSES?.trim() || 'pending,partial,error')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const firstSkipCsvPath = process.env.FIFO_FIRST_SKIP_CSV?.trim();

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

  console.log(
    [
      `April CONCRETO FIFO backfill (all plants unless FIFO_PLANT_ID set)`,
      `  fecha ${dateFrom} .. ${dateTo}  tipo_remision=${tipoRemision}`,
      includeAllocated ? '  mode: ALL fifo_status (re-run allocated)' : `  fifo_status in (${statuses.join(',')})`,
      plantId ? `  plant filter: ${plantId}` : '',
      `  Tip: use npm run fifo:month-run for gaps + backfill + CSV reports`,
    ]
      .filter(Boolean)
      .join('\n')
  );

  const {
    exactCount,
    remRows,
    fullComplete,
    partial,
    fail,
    firstSkipByKey,
    plantQueues,
  } = await runFifoBackfillQueues({
    supabase,
    fetchOpts,
    actor,
    verbosePerRemision: true,
    progressEvery: 40,
  });

  console.log(
    [
      exactCount != null ? `  remisiones (DB count): ${exactCount}` : '',
      `  remisiones loaded: ${remRows.length}${exactCount != null && exactCount !== remRows.length ? ' *** MISMATCH ***' : ''}`,
      `  execution: ${plantQueues} plant queue(s) in parallel (FIFO order within each plant)`,
    ]
      .filter(Boolean)
      .join('\n')
  );

  if (exactCount != null && exactCount !== remRows.length) {
    console.error(
      'ERROR: loaded row count does not match DB count — check pagination / filters (should not happen).'
    );
    process.exit(1);
  }

  const processed = fullComplete + partial;
  console.log('');
  console.log('--- Summary ---');
  console.log(`  processed (no exception): ${processed}`);
  console.log(`  full_complete (no errors/skips): ${fullComplete}`);
  console.log(`  partial (skipped lines and/or errors): ${partial}`);
  console.log(`  exceptions (thrown): ${fail}`);
  console.log(
    partial > 0 || fail > 0
      ? '  Tip: partials often mean insufficient inventory or missing material cost — fix layers/prices and re-run.'
      : '  All remisiones fully allocated for this filter.'
  );

  const firstSkips = [...firstSkipByKey.values()].sort((a, b) => {
    const da = a.first_skip_fecha.localeCompare(b.first_skip_fecha);
    if (da !== 0) return da;
    return a.plant_id.localeCompare(b.plant_id);
  });

  if (firstSkips.length > 0) {
    console.log('');
    console.log('--- First skip per plant + material (chronological process order) ---');
    const materialIds = [...new Set(firstSkips.map((x) => x.material_id))];
    const { data: materials } = await supabase
      .from('materials')
      .select('id, material_code, material_name')
      .in('id', materialIds);
    const matById = new Map((materials ?? []).map((m) => [m.id, m]));

    for (const row of firstSkips) {
      const m = matById.get(row.material_id);
      const label = m ? `${m.material_code} ${m.material_name}` : row.material_id;
      console.log(
        `  ${row.first_skip_fecha}  plant=${row.plant_id.slice(0, 8)}…  ${label}  remision=${row.first_remision_id}  ${row.reason}`
      );
    }

    if (firstSkipCsvPath) {
      const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
      const header =
        'plant_id,material_id,material_code,material_name,first_skip_fecha,first_remision_id,reason';
      const lines = firstSkips.map((row) => {
        const m = matById.get(row.material_id);
        return [
          row.plant_id,
          row.material_id,
          m?.material_code ?? '',
          m?.material_name ?? '',
          row.first_skip_fecha,
          row.first_remision_id,
          row.reason,
        ]
          .map((c) => esc(String(c)))
          .join(',');
      });
      fs.writeFileSync(firstSkipCsvPath, [header, ...lines].join('\n') + '\n', 'utf8');
      console.log(`Wrote ${firstSkipCsvPath}`);
    }
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
