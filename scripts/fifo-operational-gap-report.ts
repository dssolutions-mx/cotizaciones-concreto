/**
 * FIFO operational gap report (read-only DB analysis).
 *
 * Calls fn_fifo_operational_gaps(p_from, p_to): classifies each CONCRETO remisión
 * material line vs material_entries snapshot — breakpoints for ops / month-end.
 *
 * Usage (repo root):
 *   npx tsx --env-file=.env.local scripts/fifo-operational-gap-report.ts
 *   npx tsx --env-file=.env.local scripts/fifo-operational-gap-report.ts --from 2026-04-01 --to 2026-04-30
 *   FIFO_GAP_FROM=2026-05-01 FIFO_GAP_TO=2026-05-31 npx tsx --env-file=.env.local scripts/fifo-operational-gap-report.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIFO_GAP_FROM / FIFO_GAP_TO (defaults: April 2026 full month)
 *   FIFO_GAP_OUT — optional path for CSV (default: scripts/tmp/fifo-operational-gaps-<from>-<to>.csv)
 *   FIFO_GAP_TRIAGE_OUT — optional path for insufficient-stock triage CSV (deduped by plant+material)
 *
 * If the RPC returns exactly 1000 rows, the result may be truncated by PostgREST max-rows; widen the
 * date window or run overlapping ranges and merge CSVs until counts stabilize.
 *
 * Exit: 0 always after successful fetch (even if gaps exist); 1 on RPC error.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import {
  aggregateInsufficientStockSnapshot,
  insufficientStockAggToCsv,
  type GapRow,
} from './lib/fifoGapInsufficientTriage';

/** PostgREST default row cap per request — RPC results may truncate at this boundary. */
const RPC_ROW_TRUNCATION_WARNING_THRESHOLD = 1000;

const DEFAULT_FROM = '2026-04-01';
const DEFAULT_TO = '2026-04-30';

function parseArgs(): { from: string; to: string } {
  const argv = process.argv.slice(2);
  let from = process.env.FIFO_GAP_FROM ?? DEFAULT_FROM;
  let to = process.env.FIFO_GAP_TO ?? DEFAULT_TO;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) {
      from = argv[++i];
    } else if (argv[i] === '--to' && argv[i + 1]) {
      to = argv[++i];
    }
  }
  return { from, to };
}

function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: GapRow[]): string {
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

function printChecklist(from: string, to: string): void {
  console.log('\n--- Month transition checklist (process + data) ---');
  console.log(
    `Report window: ${from} .. ${to}. Adjust dates for April 30 close / May 1 start as needed.\n`
  );
  console.log('Close (e.g. April 30):');
  console.log('  1. Run this report for the closing month; resolve FIRST_RECEIPT_AFTER_POUR_DATE by');
  console.log('     correcting entry_date on receipts that physically arrived before the pour, or');
  console.log('     accepting uncosted lines until policy changes.');
  console.log('  2. Fix NO_RECEIPTS_IN_SYSTEM (book missing entries) and INSUFFICIENT_STOCK_SNAPSHOT');
  console.log('     (layers depleted or remaining_quantity_kg wrong — reconcile inventory replay).');
  console.log('  3. For lines with kg_received_after_pour > 0 but cost missing: inventory exists');
  console.log('     after pour date — strict FIFO will not use those kg for that pour; ops sees timing.');
  console.log('  4. Re-run FIFO backfill for the month after data fixes (see scripts/backfill-fifo-april-2026.ts).');
  console.log('\nOpen (e.g. May 1):');
  console.log('  1. Apply opening layers / remaining_quantity_kg for May if you reset inventory.');
  console.log('  2. Ensure procurement entry_date matches accounting period for new receipts.');
  console.log('  3. Run this report for May early to catch receipt-vs-pour ordering issues.\n');
}

async function main(): Promise<void> {
  const { from, to } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('fn_fifo_operational_gaps', {
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error('fn_fifo_operational_gaps:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as GapRow[];

  if (rows.length >= RPC_ROW_TRUNCATION_WARNING_THRESHOLD) {
    console.warn(
      `\nWARNING: fn_fifo_operational_gaps returned ${rows.length} rows — PostgREST often caps at ${RPC_ROW_TRUNCATION_WARNING_THRESHOLD}. If your month has more material lines, this report may be incomplete. Split the date range or merge overlapping runs.\n`
    );
  }

  const byReason = new Map<string, number>();
  for (const r of rows) {
    const c = r.reason_code ?? 'UNKNOWN';
    byReason.set(c, (byReason.get(c) ?? 0) + 1);
  }

  const gaps = rows.filter((r) => r.reason_code !== 'ALLOCATED');
  const timingHints = gaps.filter(
    (r) =>
      r.kg_received_after_pour != null &&
      Number(r.kg_received_after_pour) > 0 &&
      r.reason_code !== 'ALLOCATED'
  );

  console.log(`FIFO operational gaps: ${rows.length} lines (${from} .. ${to})\n`);
  console.log('Counts by reason_code:');
  const sortedReasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
  for (const [code, n] of sortedReasons) {
    console.log(`  ${code}: ${n}`);
  }

  const plantMaterial = new Map<string, number>();
  for (const r of gaps) {
    const k = `${r.plant_code ?? '?'}\t${r.material_name ?? '?'}`;
    plantMaterial.set(k, (plantMaterial.get(k) ?? 0) + 1);
  }
  const topPm = [...plantMaterial.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topPm.length > 0) {
    console.log('\nTop plant + material (non-ALLOCATED lines only):');
    for (const [k, n] of topPm) {
      console.log(`  ${n}\t${k.replace('\t', ' / ')}`);
    }
  }

  const insufficientAgg = aggregateInsufficientStockSnapshot(rows);
  if (insufficientAgg.length > 0) {
    console.log('\n--- INSUFFICIENT_STOCK_SNAPSHOT triage (deduped by plant + material) ---');
    console.log(`Unique plant+material combinations: ${insufficientAgg.length}`);
    for (const row of insufficientAgg.slice(0, 25)) {
      console.log(
        `  ${row.line_count} lines\t${row.plant_code}\t${row.material_name}\tmin_avail=${row.min_available_kg_leq_pour}\tmax_qty=${row.max_cantidad_kg}`
      );
    }
    if (insufficientAgg.length > 25) {
      console.log(`  … ${insufficientAgg.length - 25} more (see triage CSV)`);
    }
    console.log(
      'Use: npm run fifo:verify-layers -- --plant <uuid> --material <uuid> --as-of YYYY-MM-DD'
    );
  }

  console.log(
    `\nLines with kg_received_after_pour > 0 (still non-ALLOCATED): ${timingHints.length}`
  );
  printChecklist(from, to);

  const outDir = path.join(process.cwd(), 'scripts', 'tmp');
  const outPath =
    process.env.FIFO_GAP_OUT?.trim() ||
    path.join(outDir, `fifo-operational-gaps-${from}_${to}.csv`);
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  } catch {
    /* ignore */
  }
  fs.writeFileSync(outPath, rowsToCsv(rows), 'utf8');
  console.log(`Wrote CSV: ${outPath}`);

  const triagePath =
    process.env.FIFO_GAP_TRIAGE_OUT?.trim() ||
    path.join(outDir, `fifo-gaps-insufficient-triage-${from}_${to}.csv`);
  if (insufficientAgg.length > 0) {
    try {
      fs.mkdirSync(path.dirname(triagePath), { recursive: true });
    } catch {
      /* ignore */
    }
    fs.writeFileSync(triagePath, insufficientStockAggToCsv(insufficientAgg) + '\n', 'utf8');
    console.log(`Wrote insufficient-stock triage CSV: ${triagePath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
