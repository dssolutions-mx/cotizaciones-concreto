/**
 * Import material_entries for water deliveries from a CSV (e.g. VIAJES DE AGUA ABRIL.csv).
 * Mirrors POST /api/inventory/entries semantics: liters UOM, ENT-YYYYMMDD-### per plant, chained inventory_before/after.
 *
 * CSV columns (header row): FECHA,FOLIO,PROVEEDOR,LITROS
 * - FECHA: M/D/YY (e.g. 4/1/26 → 2026-04-01)
 * - FOLIO → supplier_invoice
 *
 * Usage (repo root):
 *   WATER_IMPORT_PLANT_ID=<uuid> \
 *   WATER_IMPORT_MATERIAL_ID=<uuid> \
 *   WATER_IMPORT_SUPPLIER_ID=<uuid> \
 *   WATER_IMPORT_ENTERED_BY=<user_profiles.id> \
 *   WATER_IMPORT_CSV="./VIAJES DE AGUA ABRIL.csv" \
 *   npx tsx --env-file=.env.local scripts/import-water-trips-from-csv.ts
 *
 * Optional:
 *   WATER_IMPORT_DRY_RUN=true   — parse + plan only, no inserts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role JWT)
 *
 * After import: link PO/pricing in the app; re-run FIFO for April if needed:
 *   FIFO_PLANT_ID=<plant> FIFO_DATE_FROM=2026-04-01 FIFO_DATE_TO=2026-04-30 \
 *     npx tsx --env-file=.env.local scripts/backfill-fifo-remisiones-range.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { assertSupabaseServiceRoleKey } from './lib/assertSupabaseServiceRoleKey';

type CsvRow = {
  entryDate: string;
  folio: string;
  proveedor: string;
  liters: number;
};

function parseMdYyToIso(fecha: string): string {
  const parts = fecha.trim().split('/');
  if (parts.length !== 3) throw new Error(`FECHA inválida: "${fecha}"`);
  const m = Number(parts[0]);
  const d = Number(parts[1]);
  let y = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
    throw new Error(`FECHA inválida: "${fecha}"`);
  }
  if (y < 100) y += 2000;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const out: CsvRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /^FECHA/i.test(line)) continue;
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 4) continue;
    const [fechaRaw, folioRaw, proveedor, litersRaw] = cols;
    const liters = Number(String(litersRaw).replace(/,/g, ''));
    if (!Number.isFinite(liters) || liters <= 0) {
      throw new Error(`LITROS inválidos en línea: ${line}`);
    }
    out.push({
      entryDate: parseMdYyToIso(fechaRaw),
      folio: folioRaw,
      proveedor,
      liters,
    });
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const plantId = process.env.WATER_IMPORT_PLANT_ID?.trim();
  const materialId = process.env.WATER_IMPORT_MATERIAL_ID?.trim();
  const supplierId = process.env.WATER_IMPORT_SUPPLIER_ID?.trim();
  const enteredBy = process.env.WATER_IMPORT_ENTERED_BY?.trim();
  const csvPath =
    process.env.WATER_IMPORT_CSV?.trim() ||
    path.join(process.cwd(), 'VIAJES DE AGUA ABRIL.csv');
  const dryRun = process.env.WATER_IMPORT_DRY_RUN === 'true';

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

  if (!plantId || !materialId || !supplierId || !enteredBy) {
    console.error(
      'Set WATER_IMPORT_PLANT_ID, WATER_IMPORT_MATERIAL_ID, WATER_IMPORT_SUPPLIER_ID, WATER_IMPORT_ENTERED_BY'
    );
    process.exit(1);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(csvPath, 'utf8');
  } catch (e) {
    console.error(`Cannot read CSV: ${csvPath}`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const rows = parseCsv(raw).sort((a, b) => {
    const c = a.entryDate.localeCompare(b.entryDate);
    if (c !== 0) return c;
    return Number(a.folio) - Number(b.folio);
  });

  console.log(`Rows: ${rows.length} from ${csvPath}${dryRun ? ' (DRY RUN)' : ''}`);

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seqNext = new Map<string, number>();

  async function allocateEntryNumber(entryDate: string): Promise<string> {
    const dateStr = entryDate.replace(/-/g, '');
    let next = seqNext.get(dateStr);
    if (next === undefined) {
      const { data: lastEntry, error } = await supabase
        .from('material_entries')
        .select('entry_number')
        .eq('plant_id', plantId)
        .ilike('entry_number', `ENT-${dateStr}-%`)
        .order('entry_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`entry_number query: ${error.message}`);
      next = lastEntry
        ? parseInt(lastEntry.entry_number.split('-').pop() || '0', 10) + 1
        : 1;
      seqNext.set(dateStr, next);
    }
    const current = next;
    seqNext.set(dateStr, current + 1);
    return `ENT-${dateStr}-${String(current).padStart(3, '0')}`;
  }

  let ok = 0;
  for (const row of rows) {
    const entryNumber = await allocateEntryNumber(row.entryDate);

    const { data: currentInventory, error: invErr } = await supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .maybeSingle();
    if (invErr) throw new Error(`material_inventory: ${invErr.message}`);

    const inventoryBefore = Number(currentInventory?.current_stock ?? 0);
    const inventoryAfter = inventoryBefore + row.liters;

    const payload: Database['public']['Tables']['material_entries']['Insert'] = {
      entry_number: entryNumber,
      plant_id: plantId,
      material_id: materialId,
      supplier_id: supplierId,
      entry_date: row.entryDate,
      entry_time: '12:00:00',
      quantity_received: row.liters,
      received_uom: 'l',
      received_qty_entered: row.liters,
      received_qty_kg: null,
      remaining_quantity_kg: null,
      supplier_invoice: row.folio,
      inventory_before: inventoryBefore,
      inventory_after: inventoryAfter,
      notes: `Import viajes agua · ${row.proveedor} · folio ${row.folio}`,
      entered_by: enteredBy,
      po_id: null,
      po_item_id: null,
    };

    if (dryRun) {
      console.log(
        `[dry-run] ${entryNumber} ${row.entryDate} L=${row.liters} inv ${inventoryBefore}→${inventoryAfter} folio=${row.folio}`
      );
      ok++;
      continue;
    }

    const { data: inserted, error: insErr } = await supabase
      .from('material_entries')
      .insert(payload)
      .select('id')
      .single();
    if (insErr) {
      console.error(`FAIL ${entryNumber}: ${insErr.message}`);
      process.exit(1);
    }
    console.log(`OK ${entryNumber} id=${inserted?.id} ${row.entryDate} L=${row.liters}`);
    ok++;
  }

  console.log(`Done. inserted=${ok}`);
  if (!dryRun && ok > 0) {
    console.log('');
    console.log('Next: link PO/pricing on entries; optionally re-run FIFO for April for this plant.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
