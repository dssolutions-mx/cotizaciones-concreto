/**
 * One-off backfill: re-runs the GUM uncertainty rollup for every closed
 * verification that doesn't yet have `gum_rollup_status='ok'`. Used after the
 * Phase 2 migration to populate historical verifications that pre-date the
 * studies module (or whose rollup failed silently before the .catch fix).
 *
 * Each verification is processed via the same `recomputeVerificationUncertainty`
 * entry point exercised by the manual "Recalcular incertidumbre" button —
 * keeping a single code path for both manual and bulk runs.
 *
 * Run:
 *   npm run backfill:verification-uncertainty
 *   (or directly: npx tsx --env-file=.env.local scripts/backfill-verification-uncertainty.ts)
 */

import { createClient } from '@supabase/supabase-js';
import { recomputeVerificationUncertainty } from '../src/services/emaMetrologyService';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  // We use the service-role client here but DO NOT pass it through — the
  // recompute service constructs its own server client. The query below is
  // just to identify the work items.
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Find verifications that need a rollup attempt.
  // - estado = 'cerrado' (only closed verifications have a complete data set)
  // - join on metrologia row; null status OR not-ok status both qualify
  const { data: closed, error: cErr } = await supabase
    .from('completed_verificaciones')
    .select('id')
    .eq('estado', 'cerrado')
    .order('created_at', { ascending: false });
  if (cErr) throw cErr;

  const ids = (closed ?? []).map((r) => r.id as string);
  console.log(`[backfill] found ${ids.length} closed verifications`);

  // For each, check current status
  const { data: existingStatuses } = await supabase
    .from('ema_verificacion_metrologia')
    .select('completed_verificacion_id, gum_rollup_status')
    .in('completed_verificacion_id', ids);
  const statusById = new Map<string, string | null>();
  for (const row of existingStatuses ?? []) {
    statusById.set(row.completed_verificacion_id, row.gum_rollup_status as string | null);
  }

  const needs: string[] = [];
  for (const id of ids) {
    const s = statusById.get(id);
    if (s !== 'ok') needs.push(id);
  }
  console.log(`[backfill] ${needs.length} verifications need recompute`);

  const summary = { ok: 0, skipped: 0, failed: 0 };

  for (const id of needs) {
    try {
      const result = await recomputeVerificationUncertainty(id);
      if (result.status === 'ok') {
        summary.ok++;
        console.log(`[backfill] ✓ ${id} → U=${result.U} ${result.unidad ?? ''}`);
      } else {
        summary.skipped++;
        console.log(`[backfill] ⊘ ${id} → skipped: ${result.skipped_reason ?? '(no reason)'}`);
      }
    } catch (err) {
      summary.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[backfill] ✗ ${id} → failed: ${msg}`);
    }
  }

  console.log('\n[backfill] DONE');
  console.log(`  ok      : ${summary.ok}`);
  console.log(`  skipped : ${summary.skipped}`);
  console.log(`  failed  : ${summary.failed}`);
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
