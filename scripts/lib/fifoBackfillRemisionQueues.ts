import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';
import { autoAllocateRemisionFIFO } from '../../src/services/fifoPricingService';
import { clearFifoAllocationsForRemisionIds } from './clearFifoAllocationsForRemisionRange';
import {
  compareRemisionFifoBackfillRows,
  countRemisionesForFifoBackfill,
  fetchRemisionRowsPaginatedForFifoBackfill,
  type FetchRemisionIdsOptions,
  type RemisionFifoBackfillRow,
} from './fetchRemisionIdsForFifoBackfill';

export type FifoFirstSkipRow = {
  plant_id: string;
  material_id: string;
  first_skip_fecha: string;
  first_remision_id: string;
  reason: string;
};

export function mergeFirstSkipPreferEarlierDate(
  target: Map<string, FifoFirstSkipRow>,
  incoming: Map<string, FifoFirstSkipRow>
): void {
  for (const [k, v] of incoming) {
    const existing = target.get(k);
    if (!existing || v.first_skip_fecha.localeCompare(existing.first_skip_fecha) < 0) {
      target.set(k, v);
    }
  }
}

async function processPlantQueue(params: {
  plantLabel: string;
  ids: string[];
  metaByRemisionId: Map<string, RemisionFifoBackfillRow>;
  actor: string;
  supabase: SupabaseClient<Database>;
  verbosePerRemision: boolean;
  progressEvery: number;
}): Promise<{
  fullComplete: number;
  partial: number;
  fail: number;
  firstSkipByKey: Map<string, FifoFirstSkipRow>;
}> {
  const { plantLabel, ids, metaByRemisionId, actor, supabase, verbosePerRemision, progressEvery } =
    params;
  let fullComplete = 0;
  let partial = 0;
  let fail = 0;
  const firstSkipByKey = new Map<string, FifoFirstSkipRow>();

  for (let i = 0; i < ids.length; i++) {
    const rid = ids[i];
    try {
      const r = await autoAllocateRemisionFIFO(rid, actor, { supabase });
      const bad = r.errors.length + (r.skipped?.length ?? 0);
      const meta = metaByRemisionId.get(rid);
      if (meta && r.skipped?.length) {
        for (const s of r.skipped) {
          const k = `${meta.plant_id}|${s.materialId}`;
          if (!firstSkipByKey.has(k)) {
            firstSkipByKey.set(k, {
              plant_id: meta.plant_id,
              material_id: s.materialId,
              first_skip_fecha: meta.fecha,
              first_remision_id: rid,
              reason: s.reason ?? '',
            });
          }
        }
      }
      if (meta && r.errors.length) {
        for (const e of r.errors) {
          if (!e.materialId) continue;
          const k = `${meta.plant_id}|${e.materialId}`;
          if (!firstSkipByKey.has(k)) {
            firstSkipByKey.set(k, {
              plant_id: meta.plant_id,
              material_id: e.materialId,
              first_skip_fecha: meta.fecha,
              first_remision_id: rid,
              reason: `error:${e.error.slice(0, 200)}`,
            });
          }
        }
      }
      if (r.success && bad === 0) {
        fullComplete++;
        if (verbosePerRemision) {
          console.log(`${plantLabel}OK ${rid} allocations=${r.allocationsCreated}`);
        }
      } else {
        partial++;
        console.log(
          `${plantLabel}PARTIAL ${rid} success=${r.success} alloc=${r.allocationsCreated} err=${r.errors.length} skip=${r.skipped?.length ?? 0}`
        );
        if (r.errors.length) console.error(`${plantLabel}  errors:`, JSON.stringify(r.errors.slice(0, 5)));
        if ((r.skipped?.length ?? 0) > 0) {
          console.error(`${plantLabel}  skipped:`, JSON.stringify(r.skipped!.slice(0, 5)));
        }
      }
    } catch (e) {
      fail++;
      console.error(`${plantLabel}FAIL ${rid}`, e instanceof Error ? e.message : e);
    }
    if (progressEvery > 0 && ((i + 1) % progressEvery === 0 || i === ids.length - 1)) {
      console.log(`${plantLabel}Progress ${i + 1}/${ids.length}`);
    }
  }

  return { fullComplete, partial, fail, firstSkipByKey };
}

export type RunFifoBackfillQueuesResult = {
  exactCount: number | null;
  remRows: RemisionFifoBackfillRow[];
  fullComplete: number;
  partial: number;
  fail: number;
  firstSkipByKey: Map<string, FifoFirstSkipRow>;
  plantQueues: number;
};

/**
 * Paginates remisiones, partitions by plant, runs FIFO allocation with deterministic order per plant.
 */
export async function runFifoBackfillQueues(params: {
  supabase: SupabaseClient<Database>;
  fetchOpts: FetchRemisionIdsOptions;
  actor: string;
  /** Log every successful remisión (noisy). Default false. */
  verbosePerRemision?: boolean;
  /** Progress log interval per plant; 0 = only final line per plant. Default 40. */
  progressEvery?: number;
}): Promise<RunFifoBackfillQueuesResult> {
  const { supabase, fetchOpts, actor } = params;
  const verbosePerRemision = params.verbosePerRemision ?? false;
  const progressEvery = params.progressEvery ?? 40;

  const [exactCount, remRows] = await Promise.all([
    countRemisionesForFifoBackfill(supabase, fetchOpts),
    fetchRemisionRowsPaginatedForFifoBackfill(supabase, fetchOpts),
  ]);

  const resetAllocationsBeforeReplay =
    fetchOpts.includeAllocated && process.env.FIFO_RESET_ALLOCATIONS_BEFORE_BACKFILL !== 'false';

  if (resetAllocationsBeforeReplay && remRows.length > 0) {
    const cleared = await clearFifoAllocationsForRemisionIds(
      supabase,
      remRows.map((r) => r.id)
    );
    console.log(
      `  FIFO reset: deleted ${cleared.deletedAllocationRows} allocation row(s); recomputed remaining for all cost layers on each plant/material touched by those remisiones`
    );
  }

  const metaByRemisionId = new Map(remRows.map((r) => [r.id, r]));

  const byPlant = new Map<string, RemisionFifoBackfillRow[]>();
  for (const r of remRows) {
    const list = byPlant.get(r.plant_id) ?? [];
    list.push(r);
    byPlant.set(r.plant_id, list);
  }
  for (const rows of byPlant.values()) {
    rows.sort(compareRemisionFifoBackfillRows);
  }

  const plantJobs = [...byPlant.entries()].map(([pid, rows]) =>
    processPlantQueue({
      plantLabel: `[${pid.slice(0, 8)}] `,
      ids: rows.map((x) => x.id),
      metaByRemisionId,
      actor,
      supabase,
      verbosePerRemision,
      progressEvery,
    })
  );

  const results = await Promise.all(plantJobs);

  let fullComplete = 0;
  let partial = 0;
  let fail = 0;
  const firstSkipByKey = new Map<string, FifoFirstSkipRow>();

  for (const res of results) {
    fullComplete += res.fullComplete;
    partial += res.partial;
    fail += res.fail;
    mergeFirstSkipPreferEarlierDate(firstSkipByKey, res.firstSkipByKey);
  }

  return {
    exactCount,
    remRows,
    fullComplete,
    partial,
    fail,
    firstSkipByKey,
    plantQueues: byPlant.size,
  };
}
