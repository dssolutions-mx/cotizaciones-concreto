/**
 * Single entry point: merged operational gaps (no 1000-row truncation) → optional FIFO backfill
 * (parallel per plant) → postflight gaps + CSV exports.
 *
 * Usage:
 *   FIFO_ALLOCATION_ACTOR_USER_ID=<user_profiles.id> \
 *     npx tsx --env-file=.env.local scripts/fifo-month-run.ts --from 2026-04-01 --to 2026-04-30
 *
 * Or: npm run fifo:month-run
 *
 * Flags:
 *   --from YYYY-MM-DD   (default FIFO_DATE_FROM or 2026-04-01)
 *   --to YYYY-MM-DD     (default FIFO_DATE_TO or 2026-04-30)
 *   --gaps-only         fetch gap CSVs only (no actor required)
 *   --backfill-only     skip pre/post gap RPC (faster re-run after data fixes)
 *   --verbose           log every OK remisión during backfill (default: summary/progress only)
 *
 * Env (same as backfill-fifo-april-concreto-all-plants):
 *   FIFO_DATE_FROM, FIFO_DATE_TO, FIFO_PLANT_ID, FIFO_TIPO_REMISION=CONCRETO,
 *   FIFO_INCLUDE_ALLOCATED (default true), FIFO_STATUSES,
 *   FIFO_RESET_ALLOCATIONS_BEFORE_BACKFILL (default: when FIFO_INCLUDE_ALLOCATED — delete month allocations
 *     and refresh layer remaining so chronological replay is not blocked by stale later-date allocations),
 *   FIFO_RUN_OUT_DIR (default: scripts/tmp)
 *
 * Outputs (under FIFO_RUN_OUT_DIR):
 *   fifo-run-<from>_<to>-gaps-preflight.csv
 *   fifo-run-<from>_<to>-gaps-postflight.csv
 *   fifo-run-<from>_<to>-insufficient-preflight.csv
 *   fifo-run-<from>_<to>-insufficient-postflight.csv
 *   fifo-run-<from>_<to>-first-skips.csv  (only if backfill ran and there were skips/errors tracked)
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';
import { runFifoBackfillQueues } from './lib/fifoBackfillRemisionQueues';
import {
  aggregateInsufficientStockSnapshot,
  insufficientStockAggToCsv,
  type GapRow,
} from './lib/fifoGapInsufficientTriage';
import { fetchFifoOperationalGapsMerged } from './lib/fifoOperationalGapsMerged';

function parseArgs(): {
  from: string;
  to: string;
  gapsOnly: boolean;
  backfillOnly: boolean;
  verbose: boolean;
} {
  const argv = process.argv.slice(2);
  let from = process.env.FIFO_DATE_FROM?.trim() || '2026-04-01';
  let to = process.env.FIFO_DATE_TO?.trim() || '2026-04-30';
  let gapsOnly = false;
  let backfillOnly = false;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from' && argv[i + 1]) {
      from = argv[++i];
    } else if (a === '--to' && argv[i + 1]) {
      to = argv[++i];
    } else if (a === '--gaps-only') {
      gapsOnly = true;
    } else if (a === '--backfill-only') {
      backfillOnly = true;
    } else if (a === '--verbose') {
      verbose = true;
    }
  }

  if (gapsOnly && backfillOnly) {
    console.error('Use only one of --gaps-only or --backfill-only');
    process.exit(1);
  }

  return { from, to, gapsOnly, backfillOnly, verbose };
}

function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function gapRowsToCsv(rows: GapRow[]): string {
  const headers = [
    'remision_id',
    'remision_number',
    'fifo_status',
    'order_id',
    'remision_fecha',
    'remision_material_id',
    'material_id',
    'material_name',
    'plant_id',
    'plant_code',
    'cantidad_kg',
    'is_allocated',
    'reason_code',
    'detail',
    'first_receipt_ever',
    'last_receipt_on_or_before_pour',
    'available_kg_leq_pour',
    'next_receipt_after_pour',
    'kg_received_after_pour',
  ] as const;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) =>
          csvEscape(r[h as keyof GapRow] as string | number | boolean | null | undefined)
        )
        .join(',')
    );
  }
  return lines.join('\n');
}

async function writeFirstSkipsCsv(
  supabase: ReturnType<typeof createClient<Database>>,
  outPath: string,
  firstSkipByKey: Map<
    string,
    { plant_id: string; material_id: string; first_skip_fecha: string; first_remision_id: string; reason: string }
  >
): Promise<void> {
  const firstSkips = [...firstSkipByKey.values()].sort((a, b) => {
    const da = a.first_skip_fecha.localeCompare(b.first_skip_fecha);
    if (da !== 0) return da;
    return a.plant_id.localeCompare(b.plant_id);
  });
  if (firstSkips.length === 0) return;

  const materialIds = [...new Set(firstSkips.map((x) => x.material_id))];
  const { data: materials } = await supabase
    .from('materials')
    .select('id, material_code, material_name')
    .in('id', materialIds);
  const matById = new Map((materials ?? []).map((m) => [m.id, m]));

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
  fs.writeFileSync(outPath, [header, ...lines].join('\n') + '\n', 'utf8');
  console.log(`Wrote first-skips CSV: ${outPath}`);
}

function summarizeGaps(label: string, rows: GapRow[]): void {
  const byReason = new Map<string, number>();
  for (const r of rows) {
    const c = r.reason_code ?? 'UNKNOWN';
    byReason.set(c, (byReason.get(c) ?? 0) + 1);
  }
  const nonAlloc = rows.filter((r) => r.reason_code !== 'ALLOCATED').length;
  console.log(`\n--- ${label} ---`);
  console.log(`  total lines: ${rows.length}`);
  console.log(`  non-ALLOCATED: ${nonAlloc}`);
  const top = [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [code, n] of top) {
    console.log(`    ${code}: ${n}`);
  }
}

async function main(): Promise<void> {
  const { from, to, gapsOnly, backfillOnly, verbose } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const actor = process.env.FIFO_ALLOCATION_ACTOR_USER_ID?.trim();
  const plantId = process.env.FIFO_PLANT_ID?.trim();
  const tipoRemision = process.env.FIFO_TIPO_REMISION?.trim() || 'CONCRETO';
  const includeAllocated = process.env.FIFO_INCLUDE_ALLOCATED !== 'false';
  const statuses = (process.env.FIFO_STATUSES?.trim() || 'pending,partial,error')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const outDir =
    process.env.FIFO_RUN_OUT_DIR?.trim() || path.join(process.cwd(), 'scripts', 'tmp');
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    /* ignore */
  }

  const tag = `fifo-run-${from}_${to}`;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  assertSupabaseServiceRoleKey(key);

  if (!gapsOnly && !actor) {
    console.error(
      'Missing FIFO_ALLOCATION_ACTOR_USER_ID (user_profiles.id). Use --gaps-only to skip backfill.'
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let preflightRows: GapRow[] | null = null;
  let postflightRows: GapRow[] | null = null;

  if (!backfillOnly) {
    console.log(`Fetching preflight operational gaps (merged): ${from} .. ${to}`);
    preflightRows = await fetchFifoOperationalGapsMerged(supabase, from, to);
    summarizeGaps('Preflight gaps', preflightRows);
    fs.writeFileSync(path.join(outDir, `${tag}-gaps-preflight.csv`), gapRowsToCsv(preflightRows) + '\n', 'utf8');
    console.log(`Wrote ${path.join(outDir, `${tag}-gaps-preflight.csv`)}`);

    const insPre = aggregateInsufficientStockSnapshot(preflightRows);
    if (insPre.length > 0) {
      fs.writeFileSync(
        path.join(outDir, `${tag}-insufficient-preflight.csv`),
        insufficientStockAggToCsv(insPre) + '\n',
        'utf8'
      );
      console.log(`Wrote ${path.join(outDir, `${tag}-insufficient-preflight.csv`)}`);
    }
  }

  if (gapsOnly) {
    console.log('\nDone (--gaps-only).');
    process.exit(0);
  }

  const fetchOpts = {
    dateFrom: from,
    dateTo: to,
    plantId,
    tipoRemision,
    includeAllocated,
    statuses,
  };

  console.log('\n--- FIFO backfill ---');
  console.log(
    [
      `  fecha ${from} .. ${to}  tipo_remision=${tipoRemision}`,
      includeAllocated ? '  mode: ALL fifo_status (re-run allocated)' : `  fifo_status in (${statuses.join(',')})`,
      plantId ? `  plant filter: ${plantId}` : '',
      verbose ? '  verbose: per-remisión OK lines' : '  verbose: off (use --verbose for OK lines)',
    ]
      .filter(Boolean)
      .join('\n')
  );

  const backfillResult = await runFifoBackfillQueues({
    supabase,
    fetchOpts,
    actor: actor!,
    verbosePerRemision: verbose,
    progressEvery: verbose ? 40 : 40,
  });

  const { exactCount, remRows, fullComplete, partial, fail, firstSkipByKey, plantQueues } =
    backfillResult;

  console.log(`  remisiones loaded: ${remRows.length}${exactCount != null ? ` (DB count ${exactCount})` : ''}`);
  if (exactCount != null && exactCount !== remRows.length) {
    console.error('ERROR: remisión row count mismatch vs DB count.');
    process.exit(1);
  }
  console.log(`  plant parallel queues: ${plantQueues}`);

  console.log('\n--- Backfill summary ---');
  console.log(`  full_complete: ${fullComplete}`);
  console.log(`  partial: ${partial}`);
  console.log(`  exceptions: ${fail}`);

  if (firstSkipByKey.size > 0) {
    await writeFirstSkipsCsv(supabase, path.join(outDir, `${tag}-first-skips.csv`), firstSkipByKey);
  }

  console.log(`\nFetching postflight operational gaps (merged): ${from} .. ${to}`);
  postflightRows = await fetchFifoOperationalGapsMerged(supabase, from, to);
  summarizeGaps('Postflight gaps', postflightRows);
  fs.writeFileSync(path.join(outDir, `${tag}-gaps-postflight.csv`), gapRowsToCsv(postflightRows) + '\n', 'utf8');
  console.log(`Wrote ${path.join(outDir, `${tag}-gaps-postflight.csv`)}`);

  const insPost = aggregateInsufficientStockSnapshot(postflightRows);
  if (insPost.length > 0) {
    fs.writeFileSync(
      path.join(outDir, `${tag}-insufficient-postflight.csv`),
      insufficientStockAggToCsv(insPost) + '\n',
      'utf8'
    );
    console.log(`Wrote ${path.join(outDir, `${tag}-insufficient-postflight.csv`)}`);
  }

  if (preflightRows && postflightRows) {
    const preBad = preflightRows.filter((r) => r.reason_code !== 'ALLOCATED').length;
    const postBad = postflightRows.filter((r) => r.reason_code !== 'ALLOCATED').length;
    console.log(`\n--- Delta (non-ALLOCATED lines) ---`);
    console.log(`  preflight: ${preBad}`);
    console.log(`  postflight: ${postBad}`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
