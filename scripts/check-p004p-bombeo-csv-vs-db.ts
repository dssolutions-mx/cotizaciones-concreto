/**
 * Lists CSV remision numbers that already exist as BOMBEO at plant P004P (any fecha).
 * Use before import to build exclude list for generate_plant2_pumping_migration.py
 *
 * Run: npm run check:p004p-bombeo-csv-vs-db
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const PLANT_P004P_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const DEFAULT_CSV = 'BOMBEO P4p MARZO 2026.csv';

function parseCsvRemisiones(filePath: string): string[] {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  const nums: string[] = [];
  for (const row of rows) {
    const rem = row['REMISION'] ?? row['Remision'];
    if (rem == null || rem === '') continue;
    nums.push(String(rem).trim());
  }
  return nums;
}

async function main() {
  const csvPath = path.join(process.cwd(), process.argv[2] || DEFAULT_CSV);
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const expected = parseCsvRemisiones(csvPath);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing, error } = await supabase
    .from('remisiones')
    .select('remision_number, volumen_fabricado, fecha, tipo_remision')
    .eq('plant_id', PLANT_P004P_ID)
    .eq('tipo_remision', 'BOMBEO')
    .in('remision_number', expected);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = existing || [];
  console.log(`CSV remisiones: ${expected.length}`);
  console.log(`Already in DB as BOMBEO @ P004P: ${rows.length}`);
  if (rows.length > 0) {
    console.log('\nDuplicates (skip these in migration):');
    for (const r of rows) {
      console.log(
        `  ${r.remision_number} | vol=${r.volumen_fabricado} | fecha=${r.fecha}`
      );
    }
    const excludePath = path.join(process.cwd(), 'p004p_march_exclude_remisiones.txt');
    fs.writeFileSync(
      excludePath,
      rows.map((r) => String(r.remision_number)).join('\n') + '\n',
      'utf-8'
    );
    console.log(`\nWrote ${excludePath} (use with --exclude-remisiones-file)`);
  } else {
    console.log('OK: No duplicate remision numbers for this CSV.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
